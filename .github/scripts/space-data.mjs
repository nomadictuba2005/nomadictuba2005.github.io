// Runs in GitHub Actions every 2 hours. Fetches the ISS orbit and upcoming launches once and
// publishes them as data/space.json on the site, so phones never hit the APIs' rate limits.
// Usage: node space-data.mjs <output file> [url of the currently live space.json]

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [out, liveUrl] = process.argv.slice(2);
const get = (url, opts = {}) => fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Breeze weather app (github.com/nomadictuba2005)' }, ...opts });

// What's live now, so one failed fetch doesn't wipe out good data
let live = {};
if (liveUrl) try { live = await (await get(liveUrl)).json(); } catch {}

async function orbit() {
  try {
    const lines = (await (await get('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle')).text()).trim().split('\n').map(s => s.trim());
    if (lines[1]?.startsWith('1 ') && lines[2]?.startsWith('2 ')) return [lines[1], lines[2]];
  } catch {}
  try {
    const j = await (await get('https://api.wheretheiss.at/v1/satellites/25544/tles')).json();
    if (j.line1 && j.line2) return [j.line1, j.line2];
  } catch {}
  return null;
}

async function launchLibrary() {
  const res = await get('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=12&mode=normal&hide_recent_previous=true');
  if (!res.ok) throw new Error('Launch Library ' + res.status);
  return (await res.json()).results.map(r => {
    const [rocket, mission] = r.name.split(' | ');
    return {
      rocket, mission: /^unknown payload$/i.test(mission || '') ? null : mission, net: r.net, precision: r.net_precision?.abbrev,
      status: r.status?.abbrev, place: (r.pad?.location?.name || '').replace(/, (USA|People's Republic of China)$/, ''),
      lat: +r.pad?.latitude, lon: +r.pad?.longitude,
    };
  });
}

// Backup source. It has no pad coordinates, so the main launch sites are listed here.
const SITES = {
  'cape canaveral': [28.49, -80.58], 'kennedy': [28.6, -80.6], 'vandenberg': [34.63, -120.61], 'starbase': [25.99, -97.15],
  'wallops': [37.84, -75.48], 'mahia': [-39.26, 177.86], 'wenchang': [19.61, 110.95], 'jiuquan': [40.96, 100.29],
  'xichang': [28.25, 102.03], 'taiyuan': [38.85, 111.61], 'baikonur': [45.92, 63.34], 'plesetsk': [62.93, 40.58],
  'satish dhawan': [13.72, 80.23], 'tanegashima': [30.4, 130.97], 'kourou': [5.24, -52.77], 'guiana': [5.24, -52.77],
  'vostochny': [51.88, 128.33], 'kodiak': [57.43, -152.34],
};
async function rocketLaunchLive() {
  const res = await get('https://fdo.rocketlaunch.live/json/launches/next/5');
  if (!res.ok) throw new Error('RocketLaunch.Live ' + res.status);
  return (await res.json()).result.map(r => {
    const e = r.est_date || {};
    const net = r.t0 || r.win_open || (e.year && e.month && e.day ? new Date(Date.UTC(e.year, e.month - 1, e.day, 12)).toISOString() : null);
    if (!net) return null;
    const loc = r.pad?.location || {};
    const site = Object.entries(SITES).find(([k]) => (loc.name || '').toLowerCase().includes(k))?.[1] || [NaN, NaN];
    return {
      rocket: /unconfirmed|unknown/i.test(r.vehicle?.name || '') ? null : r.vehicle?.name, mission: r.name === 'TBD' ? null : r.name, net, precision: r.t0 || r.win_open ? 'MIN' : 'DAY',
      status: null, place: [loc.name, loc.state || loc.country].filter(Boolean).join(', '), lat: site[0], lon: site[1],
    };
  }).filter(Boolean);
}

async function launches() {
  for (const source of [launchLibrary, rocketLaunchLive]) {
    try { return await source(); } catch (e) { console.log(e.message); }
  }
  return null;
}

const [tle, list] = await Promise.all([orbit(), launches()]);
const now = new Date().toISOString();
const data = {
  tle: tle || live.tle || null, tleAt: tle ? now : live.tleAt || null,
  launches: list || live.launches || null, launchesAt: list ? now : live.launchesAt || null,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data));
console.log(`orbit: ${tle ? 'fresh' : 'kept'}, launches: ${list ? `${list.length} fresh` : 'kept'}`);
