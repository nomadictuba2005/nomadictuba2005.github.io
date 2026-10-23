// Space extras for the weather screen: when you can see the ISS, and upcoming rocket launches.
// Your location never leaves the phone: passes are worked out here, and launches are filtered here.

import { twoline2satrec, propagate, gstime, degreesToRadians, eciToEcf, ecfToLookAngles, sunPos, shadowFraction, jday } from './vendor/satellite.js';

const TLE_KEY = 'breeze.issOrbit';
const LAUNCH_KEY = 'breeze.launches';
const AU_KM = 149597870.7;
const DEG = 180 / Math.PI;

const get = url => fetch(url, { signal: AbortSignal.timeout(8000) });

// Saved copies keep us under the APIs' rate limits, and an old copy beats nothing when offline.
// Calls that arrive while a request is already out share it.
const inFlight = {};
function cached(key, maxAge, fetcher) {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
  if (saved && Date.now() - saved.at < maxAge) return Promise.resolve(saved.data);
  return inFlight[key] ||= fetcher()
    .then(data => {
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
      return data;
    })
    .catch(() => saved?.data ?? null)
    .finally(() => delete inFlight[key]);
}

// Our own copy of the orbit and launch schedule, refreshed every 2 hours by a GitHub Action
// (.github/scripts/space-data.mjs). Reading it means phones never hit the APIs' rate limits.
// The APIs below are only a backup for when it's missing or stale.
let feed;
const getFeed = () => feed ||= get('data/space.json').then(r => r.ok ? r.json() : null).catch(() => null);
const fresh = (at, hours) => at && Date.now() - Date.parse(at) < hours * 36e5;

// ---------- ISS ----------

// The ISS's orbit as two lines of numbers (a "TLE"). Asks two sources and uses whichever answers first.
async function getOrbit() {
  const f = await getFeed();
  return fresh(f?.tleAt, 48) ? f.tle : orbitFromApis();
}
const orbitFromApis = () => cached(TLE_KEY, 12 * 36e5, () => Promise.any([
  get('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle').then(async res => {
    const lines = (await res.text()).trim().split('\n').map(s => s.trim());
    if (!res.ok || !lines[1]?.startsWith('1 ') || !lines[2]?.startsWith('2 ')) throw new Error('celestrak');
    return [lines[1], lines[2]];
  }),
  get('https://api.wheretheiss.at/v1/satellites/25544/tles').then(res => res.json()).then(j => {
    if (!j.line1 || !j.line2) throw new Error('wheretheiss');
    return [j.line1, j.line2];
  }),
]));

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const compass = az => COMPASS[Math.round(az * DEG / 45) % 8];

// Steps through the next few days looking for times the ISS is visible: at least 10° up,
// lit by the sun, while the sky where you are is dark.
function findPasses(orbit, lat, lon, days = 10, want = 6) {
  const sat = twoline2satrec(orbit[0], orbit[1]);
  const here = { latitude: degreesToRadians(lat), longitude: degreesToRadians(lon), height: 0 };
  const passes = [];
  let cur = null;
  const start = Date.now() - 5 * 60e3; // include a pass that's happening right now
  for (let t = start; t < start + days * 864e5 && passes.length < want; t += 20e3) {
    const date = new Date(t);
    const pv = propagate(sat, date);
    let visible = false, look;
    if (pv) {
      const gmst = gstime(date);
      look = ecfToLookAngles(here, eciToEcf(pv.position, gmst));
      if (look.elevation * DEG >= 10) {
        const sun = sunPos(jday(date)).rsun;
        const sunKm = { x: sun.x * AU_KM, y: sun.y * AU_KM, z: sun.z * AU_KM };
        const sunUp = ecfToLookAngles(here, eciToEcf(sunKm, gmst)).elevation * DEG;
        visible = sunUp < -6 && shadowFraction(sun, pv.position) < 0.5;
      }
    }
    if (visible) {
      const el = look.elevation * DEG;
      if (!cur) cur = { start: t, end: t, maxEl: el, from: compass(look.azimuth), to: compass(look.azimuth) };
      cur.end = t;
      cur.to = compass(look.azimuth);
      cur.maxEl = Math.max(cur.maxEl, el);
    } else if (cur) {
      if (cur.end - cur.start >= 60e3) passes.push(cur);
      cur = null;
    }
  }
  return passes;
}

let memo = null;
export async function issPasses(lat, lon) {
  const orbit = await getOrbit();
  if (!orbit) return null;
  const key = `${orbit[0]}|${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (memo?.key === key && Date.now() - memo.at < 10 * 60e3) return memo.passes;
  const all = findPasses(orbit, lat, lon);
  // Skip quick, low glimpses if a proper pass is coming soon after
  const good = all.find(p => p.maxEl >= 15 && p.end - p.start >= 2 * 60e3);
  const passes = good && good.start - (all[0]?.start ?? 0) < 2 * 864e5 ? [good] : all.slice(0, 1);
  memo = { key, at: Date.now(), passes };
  return passes;
}

// ---------- Rocket launches ----------

async function getLaunches() {
  const f = await getFeed();
  return fresh(f?.launchesAt, 6) ? f.launches : launchesFromApi();
}
const launchesFromApi = () => cached(LAUNCH_KEY, 2 * 36e5, async () => {
  const res = await get('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=12&mode=normal&hide_recent_previous=true');
  if (!res.ok) throw new Error('launches ' + res.status);
  return (await res.json()).results.map(r => {
    const [rocket, mission] = r.name.split(' | ');
    return {
      rocket, mission: /^unknown payload$/i.test(mission || '') ? null : mission, net: r.net, precision: r.net_precision?.abbrev, status: r.status?.abbrev,
      place: (r.pad?.location?.name || '').replace(/, (USA|People's Republic of China)$/, ''),
      lat: +r.pad?.latitude, lon: +r.pad?.longitude,
    };
  });
});

const miles = (lat1, lon1, lat2, lon2) => {
  const r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.sqrt(a));
};

// The next few launches anywhere, plus the next one close enough that you might see it.
export async function upcomingLaunches(lat, lon) {
  const all = await getLaunches();
  if (!all) return null;
  const list = all
    .filter(l => Date.parse(l.net) > Date.now() - 30 * 60e3 && !/Success|Failure/.test(l.status || ''))
    .map(l => ({ ...l, near: miles(lat, lon, l.lat, l.lon) < 250 }));
  const shown = list.slice(0, 3);
  const near = list.find(l => l.near);
  if (near && !shown.includes(near)) shown[2] = near;
  return shown;
}
