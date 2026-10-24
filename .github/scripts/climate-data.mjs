// Builds data/climate.json: typical weather for each month at places across the US and the world.
// The app uses it to show a believable forecast when it can't reach the weather service.
// Run by hand (it doesn't need to change): node .github/scripts/climate-data.mjs
// Source: Open-Meteo's historical weather API (ERA5 reanalysis), 2024 and 2025.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const STATES = new Set(['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'Puerto Rico']);
const km = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const places = readFileSync('data/places.tsv', 'utf8').trim().split('\n').map(l => {
  const [name, , region, code, lat, lon, pop] = l.split('\t');
  return { name, region, code, lat: +lat, lon: +lon, pop: +pop };
}).sort((a, b) => b.pop - a.pop);

// Up to 3 spread-out places per state, then big cities spread around the world
const points = [];
const spread = (list, max, gap) => {
  const picked = [];
  for (const p of list) {
    if (picked.length >= max) break;
    if (points.concat(picked).every(q => km(p, q) > gap)) picked.push(p);
  }
  points.push(...picked);
};
for (const s of STATES) spread(places.filter(p => p.region === s), 3, 160);
spread(places.filter(p => !STATES.has(p.region) && p.pop > 1e6), 55, 700);
console.log(points.length, 'places');

const VARS = 'temperature_2m_max,temperature_2m_min,weather_code,relative_humidity_2m_mean,wind_speed_10m_mean,cloud_cover_mean';
// Weather codes grouped the way the app draws them
const group = c => c <= 1 ? 0 : c === 2 ? 1 : c === 3 ? 2 : c <= 48 ? 3 : c >= 95 ? 6 : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 5 : 4;

mkdirSync('.climate-cache', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchPoint(p) {
  const file = `.climate-cache/${p.lat},${p.lon}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  for (;;) {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${p.lat}&longitude=${p.lon}&start_date=2024-01-01&end_date=2025-12-31&daily=${VARS}&timezone=auto`);
    if (res.status === 429) { console.log('rate limited, waiting'); await sleep(65e3); continue; }
    if (!res.ok) throw new Error(`${p.name}: ${res.status} ${await res.text()}`);
    const j = await res.json();
    writeFileSync(file, JSON.stringify(j));
    return j;
  }
}

const out = [];
for (const [i, p] of points.entries()) {
  const d = (await fetchPoint(p)).daily;
  const months = Array.from({ length: 12 }, () => ({ hi: [], lo: [], hum: [], wind: [], cloud: [], kinds: [0, 0, 0, 0, 0, 0, 0] }));
  d.time.forEach((t, k) => {
    if (d.temperature_2m_max[k] == null) return;
    const m = months[+t.slice(5, 7) - 1];
    m.hi.push(d.temperature_2m_max[k]); m.lo.push(d.temperature_2m_min[k]);
    m.hum.push(d.relative_humidity_2m_mean[k]); m.wind.push(d.wind_speed_10m_mean[k]); m.cloud.push(d.cloud_cover_mean[k]);
    m.kinds[group(d.weather_code[k])]++;
  });
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  // Per month: high °C, low °C, humidity %, wind km/h, cloud %, then the share of days (%) that were
  // clear, partly cloudy, overcast, foggy, rainy, snowy and stormy
  out.push([p.lat, p.lon, months.map(m => {
    const n = m.kinds.reduce((x, y) => x + y, 0);
    return [Math.round(avg(m.hi) * 10) / 10, Math.round(avg(m.lo) * 10) / 10, Math.round(avg(m.hum)), Math.round(avg(m.wind)), Math.round(avg(m.cloud)),
      ...m.kinds.map(k => Math.round(k / n * 100))];
  })]);
  if (i % 20 === 0) console.log(i, p.name);
  await sleep(400);
}
writeFileSync('data/climate.json', JSON.stringify(out));
console.log('wrote', out.length);
