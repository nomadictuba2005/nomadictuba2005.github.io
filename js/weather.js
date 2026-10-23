// The disguise: a real, working weather app powered by Open-Meteo (free, no API key).

import { issPasses, upcomingLaunches } from './space.js';
import { loadPlaces, suggest } from './places.js';

const PREFS_KEY = 'breeze.prefs';
const CACHE_KEY = 'breeze.lastWeather';
const DEFAULT_CITY = { name: 'Washington, D.C.', lat: 38.8951, lon: -77.0364 };

const $ = s => document.querySelector(s);

// WMO weather codes -> [label, sky]
const CODES = {
  0: ['Clear sky', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'partly'], 3: ['Overcast', 'cloud'],
  45: ['Foggy', 'fog'], 48: ['Icy fog', 'fog'],
  51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Heavy drizzle', 'rain'],
  56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'],
  61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
  80: ['Light showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Heavy showers', 'rain'],
  85: ['Snow showers', 'snow'], 86: ['Snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'], 96: ['Thunderstorm', 'storm'], 99: ['Thunderstorm', 'storm'],
};
const code = c => CODES[c] || ['Cloudy', 'cloud'];

function loadPrefs() {
  try { return { unit: 'F', city: null, ...JSON.parse(localStorage.getItem(PREFS_KEY)) }; }
  catch { return { unit: 'F', city: null }; }
}
let prefs = loadPrefs();
const savePrefs = () => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));

// ---------- Illustrations ----------
// Flat shapes drawn twice, the back copy offset and multiplied, like a two-color risograph print.

const INK = '#2e2748';
const CLOUD = 'M-62 40a30 30 0 0 1 4-60 42 42 0 0 1 80-12 32 32 0 0 1 42 40 26 26 0 0 1-6 32z';
const BLOB = 'M0-52c30 0 54 20 53 52S30 53 0 52-53 32-52 0-30-52 0-52z';

const eyes = (x = 0, y = 0, sleepy = false) => sleepy
  ? `<path d="M${x - 17} ${y}q5 5 10 0M${x + 7} ${y}q5 5 10 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
  : `<circle cx="${x - 12}" cy="${y}" r="4" fill="${INK}"/><circle cx="${x + 12}" cy="${y}" r="4" fill="${INK}"/>`;

const print = (shape, front, back, dx = 7, dy = 6) =>
  `<g transform="translate(${dx} ${dy})" fill="${back}" style="mix-blend-mode:multiply">${shape}</g><g fill="${front}">${shape}</g>`;

// ---------- Moon ----------

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

// Age in days since the last new moon, how much of it is lit (0-1), and whether it's growing.
function moonPhase(date = new Date()) {
  const age = (((date - NEW_MOON_REF) / 864e5) % SYNODIC + SYNODIC) % SYNODIC;
  return { age, lit: (1 - Math.cos(2 * Math.PI * age / SYNODIC)) / 2, waxing: age < SYNODIC / 2 };
}

const MOON_NAMES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent', 'New moon'];
const moonName = age => MOON_NAMES[Math.floor((age / SYNODIC) * 8 + 0.5)];

// The sunlit part of the moon as seen from here. Northern skies see a waxing moon lit on the right.
let south = false;
const flipMoon = waxing => waxing === south;
function moonLit(r, { lit, waxing }) {
  const k = r * Math.abs(1 - 2 * lit);
  const d = `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${k} ${r} 0 0 ${lit > 0.5 ? 1 : 0} 0 ${-r}Z`;
  return `<g transform="scale(${flipMoon(waxing) ? -1 : 1} 1)"><path d="${d}"/></g>`;
}
const moonDisc = (r, phase, dark, dx, dy) =>
  `<circle r="${r}" fill="${dark}"/>${print(moonLit(r, phase), '#ffe7a3', '#ff8e72', dx, dy)}`;

function nightMoon() {
  const m = moonPhase();
  if (m.lit < 0.4) { // too thin for a face, so use the chunky cartoon crescent
    const flip = m.waxing !== south ? -1 : 1;
    return `<g transform="scale(${flip} 1)">${print(`<path d="M18-50a52 52 0 1 0 34 72A44 44 0 0 1 18-50z"/>`, '#ffe7a3', '#ff8e72')}${eyes(-10, 4, true)}</g>`;
  }
  const side = flipMoon(m.waxing) ? -1 : 1;
  return moonDisc(52, m, '#8798d8') + eyes(side * 52 * (1 - m.lit), 4, true);
}

function art(sky, isDay) {
  const sun = `<path d="${BLOB}"/>`;
  const cloud = `<path d="${CLOUD}"/>`;
  switch (sky) {
    case 'sun':
      return isDay
        ? print(sun, '#ffc93c', '#ff8e72') + eyes(0, -2)
        : nightMoon();
    case 'partly':
      return `<g transform="translate(-28 -34) scale(.8)">${isDay ? print(sun, '#ffc93c', '#ff8e72') : moonDisc(48, moonPhase(), '#8798d8')}</g>
        <g transform="translate(16 20)">${print(cloud, '#ffffff', '#f2a99a')}${eyes(4, 14, !isDay)}</g>`;
    case 'rain':
      return `<g transform="translate(0 -18)">${print(cloud, '#ffffff', '#8c9cf5')}${eyes(4, 14)}</g>
        ${[-36, -8, 20, 48].map((x, i) => `<path class="drop" style="animation-delay:${i * 0.35}s" d="M${x} 46q-7 12 0 16q7-4 0-16z" fill="#4e63d9"/>`).join('')}`;
    case 'snow':
      return `<g transform="translate(0 -18)">${print(cloud, '#ffffff', '#a9b8f5')}${eyes(4, 14)}</g>
        ${[-36, -8, 20, 48].map((x, i) => `<circle class="drop" style="animation-delay:${i * 0.45}s" cx="${x}" cy="54" r="6" fill="#ffffff" stroke="${INK}" stroke-width="2.5"/>`).join('')}`;
    case 'storm':
      return `<g transform="translate(0 -18)">${print(cloud, '#f3f1ff', '#7d74c9')}${eyes(4, 14, true)}</g>
        ${print('<path d="M4 34-14 64h16l-8 28 30-38H8l10-20z"/>', '#ffc93c', '#ff8e72', 4, 4)}`;
    case 'fog':
      return `<g transform="translate(0 -14)">${print(cloud, '#ffffff', '#9fcfa8')}${eyes(4, 14, true)}</g>
        <path d="M-58 52h70M-30 70h86" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/>`;
    default:
      return `${print(cloud, '#ffffff', '#9fcfa8')}${eyes(4, 14)}`;
  }
}

const artSvg = (sky, isDay) => `<svg viewBox="-100 -100 200 200" role="img" aria-label="${code(0)[0]}">${art(sky, isDay)}</svg>`;

// Tiny line glyphs for the week list
function glyph(sky) {
  const c = '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.7 3.7 0 0 1 17.5 18z"/>';
  const g = {
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    partly: '<path d="M9 9.5a4 4 0 0 1 6.5-3.2M10 3v1.2M4.6 5.3l.9.9M3 10.5h1.2"/><path d="M8 20a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.5 1.5A3.3 3.3 0 0 1 18 20z"/>',
    cloud: c,
    fog: '<path d="M7 14a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.7 3.7 0 0 1 17.5 14z"/><path d="M5 18h14M8 21.5h10"/>',
    rain: '<path d="M7 14a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.7 3.7 0 0 1 17.5 14z"/><path d="M8 17.5v3M12 17.5v3M16 17.5v3"/>',
    snow: '<path d="M7 14a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.7 3.7 0 0 1 17.5 14z"/><path d="M8 19h.01M12 21h.01M16 19h.01"/>',
    storm: '<path d="M7 14a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.7 3.7 0 0 1 17.5 14z"/><path d="m12.5 14-2 3.5h3l-2 3.5"/>',
  }[sky] || c;
  return `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}</svg>`;
}

// ---------- Data fetching ----------

async function fetchWeather(city) {
  const unit = prefs.unit === 'C' ? 'celsius' : 'fahrenheit';
  const wind = prefs.unit === 'C' ? 'kmh' : 'mph';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day'
    + '&hourly=temperature_2m,weather_code,is_day,cloud_cover'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset,daylight_duration'
    + `&temperature_unit=${unit}&wind_speed_unit=${wind}&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather ' + res.status);
  return res.json();
}

async function geocode(q) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results || []).map(r => ({
    name: [r.name, r.admin1, r.country_code === 'US' ? null : r.country].filter(Boolean).join(', '),
    lat: r.latitude, lon: r.longitude,
  }));
}

async function reverseName(lat, lon) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const j = await res.json();
    // `city` is sometimes a census district or metro area (e.g. "South Coast"),
    // so prefer the real city (admin level 8), then the locality.
    const admin = j.localityInfo?.administrative || [];
    const town = admin.find(a => a.adminLevel === 8)?.name || j.locality || j.city;
    return [town, j.principalSubdivision].filter(Boolean).join(', ') || 'Your location';
  } catch { return 'Your location'; }
}

// ---------- Rendering ----------

// Today's temperatures as one smooth line, with the hour under each point.
function dayLine(w, from) {
  const col = 54, h = 132, top = 34, base = 92;
  const idx = [];
  for (let j = from; j < Math.min(from + 24, w.hourly.time.length); j++) idx.push(j);
  const temps = idx.map(j => w.hourly.temperature_2m[j]);
  const lo = Math.min(...temps), hi = Math.max(...temps);
  const pts = temps.map((t, i) => [i * col + col / 2, top + (1 - (t - lo) / (hi - lo || 1)) * (base - top - 14)]);
  let d = `M${pts[0]}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p2 = pts[i], p3 = pts[i + 1] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2}`;
  }
  const width = pts.length * col;
  const labels = idx.map((j, i) => {
    const [x, y] = pts[i];
    const hr = i === 0 ? 'Now' : new Date(w.hourly.time[j]).toLocaleTimeString([], { hour: 'numeric' }).replace(' ', '').toLowerCase();
    return `<text x="${x}" y="${y - 12}" class="t">${Math.round(temps[i])}°</text><text x="${x}" y="${h - 8}" class="h">${hr}</text>`;
  }).join('');
  return `<svg width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" aria-label="Temperature for the next 24 hours">
    <path d="${d} L${pts.at(-1)[0]},${base} L${pts[0][0]},${base}Z" class="area"/>
    <path d="${d}" class="line"/>
    <circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="6" class="dot"/>
    ${labels}</svg>`;
}

// Times from Open-Meteo are already local to the city ("2026-10-23T07:21"), so read them as text
// instead of through Date, which would shift them into the phone's time zone.
const mins = iso => +iso.slice(11, 13) * 60 + +iso.slice(14, 16);
const clock = iso => {
  const h = +iso.slice(11, 13), m = iso.slice(14, 16);
  return `${h % 12 || 12}${m === '00' ? '' : ':' + m}${h < 12 ? 'am' : 'pm'}`;
};
const span = m => { m = Math.round(m); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };

// Sunrise to sunset as an arc, with the sun where it is right now.
function sunArc(w) {
  const rise = w.daily.sunrise[0], set = w.daily.sunset[0], now = w.current.time;
  const t = (mins(now) - mins(rise)) / (mins(set) - mins(rise));
  const up = t >= 0 && t <= 1;
  const x = 160 - 136 * Math.cos(Math.PI * Math.min(Math.max(t, 0), 1));
  const y = 100 - 80 * Math.sin(Math.PI * Math.min(Math.max(t, 0), 1));
  let next;
  if (up) next = `Sunset in ${span(mins(set) - mins(now))}`;
  else if (t < 0) next = `Sunrise in ${span(mins(rise) - mins(now))}`;
  else next = w.daily.sunrise[1] ? `Sunrise in ${span(24 * 60 - mins(now) + mins(w.daily.sunrise[1]))}` : '';
  return `<svg class="wx-arc" viewBox="0 0 320 128" role="img" aria-label="Sunrise ${clock(rise)}, sunset ${clock(set)}">
    <clipPath id="wx-arc-clip"><rect width="${up ? x : t > 1 ? 320 : 0}" height="100"/></clipPath>
    <path d="M8 100H312" class="horizon"/>
    <path d="M24 100A136 80 0 0 1 296 100" class="track"/>
    <path d="M24 100A136 80 0 0 1 296 100" class="done" clip-path="url(#wx-arc-clip)"/>
    ${up ? `<circle cx="${x}" cy="${y}" r="10" class="sun"/>` : ''}
    <text x="160" y="72" class="big">${span(w.daily.daylight_duration[0] / 60)} of daylight</text>
    <text x="160" y="92" class="sub">${next}</text>
    <text x="8" y="122" class="end">Sunrise ${clock(rise)}</text>
    <text x="312" y="122" class="end right">Sunset ${clock(set)}</text>
  </svg>`;
}

// How good tonight is for stars: the clouds overnight, and how bright the moon is.
function stargazing(w, moon) {
  const now = w.current.time;
  // Before dawn, look at what's left of the night, unless it's nearly over
  const [from, to] = mins(now) < mins(w.daily.sunrise[0]) - 120
    ? [now.slice(0, 13), w.daily.sunrise[0]]
    : [w.daily.sunset[0].slice(0, 13), w.daily.sunrise[1] || '9999'];
  const hours = w.hourly.time.map((t, i) => i).filter(i => w.hourly.time[i] >= from && w.hourly.time[i] < to);
  if (!hours.length) return null;
  const cloud = hours.map(i => w.hourly.cloud_cover[i]);
  const avg = cloud.reduce((a, b) => a + b, 0) / cloud.length;
  const best = hours[cloud.indexOf(Math.min(...cloud))];
  const bright = moon.lit > 0.6 ? ' The bright moon will hide fainter stars.' : '';
  if (avg >= 75 && Math.min(...cloud) >= 60) return ['Cloudy tonight', 'Too cloudy to see the stars.'];
  if (avg <= 25) return bright ? ['Clear tonight', bright.trim()] : ['Great night for stars', 'Clear and dark, with little moonlight.'];
  return ['Some clouds tonight', `Clearest around ${clock(w.hourly.time[best])}.${bright}`];
}

function skyView(w) {
  if (!w.daily.sunrise || !w.hourly.cloud_cover) return ''; // weather cached by an older version
  const moon = moonPhase();
  const toNext = moon.waxing ? SYNODIC / 2 - moon.age : SYNODIC - moon.age;
  const nextDate = new Date(Date.now() + toNext * 864e5).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const name = moonName(moon.age);
  const nextText = name === 'Full moon' && toNext > SYNODIC / 2 - 1.5
    ? 'Full tonight.'
    : `${moon.waxing ? 'Full' : 'New'} moon on ${nextDate}.`;
  const stars = stargazing(w, moon);
  const sparkle = '<path d="M0-30C4-8 8-4 30 0 8 4 4 8 0 30-4 8-8 4-30 0-8-4-4-8 0-30z"/>';
  return sunArc(w) + `
    <div class="wx-orb">
      <svg viewBox="-34 -34 72 72" aria-hidden="true">${moonDisc(30, moon, '#d9d4e3', 3, 3)}</svg>
      <p><b>${name}</b><span>${Math.round(moon.lit * 100)}% lit. ${nextText}</span></p>
    </div>
    ${stars ? `<div class="wx-orb">
      <svg viewBox="-34 -34 72 72" aria-hidden="true">${print(sparkle, '#ffc93c', '#ff8e72', 3, 3)}</svg>
      <p><b>${stars[0]}</b><span>${stars[1]}</span></p>
    </div>` : ''}`;
}

// ---------- ISS and launches ----------

// Times in the city's own time zone, to match the rest of the forecast
const at = (t, tz, opts) => new Date(t).toLocaleString('en-US', { timeZone: tz, ...opts });
const dayKey = (t, tz) => at(t, tz, { year: 'numeric', month: 'numeric', day: 'numeric' });
function when(t, tz) {
  t = new Date(t).getTime();
  const time = at(t, tz, { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').replace(':00', '').toLowerCase();
  const evening = +at(t, tz, { hour: 'numeric', hourCycle: 'h23' }) >= 17;
  if (dayKey(t, tz) === dayKey(Date.now(), tz)) return `${evening ? 'Tonight' : 'Today'} at ${time}`;
  if (dayKey(t, tz) === dayKey(Date.now() + 864e5, tz)) return `Tomorrow at ${time}`;
  if (t - Date.now() < 6 * 864e5) return `${at(t, tz, { weekday: 'long' })} at ${time}`;
  return `${at(t, tz, { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`;
}

const ISS_ART = print('<rect x="-34" y="-13" width="22" height="26" rx="3"/><rect x="12" y="-13" width="22" height="26" rx="3"/><rect x="-14" y="-6" width="28" height="12" rx="5"/>', '#8c9cf5', '#ffc93c', 3, 3);

function issView(passes, tz) {
  if (!passes) return '';
  const art = `<svg viewBox="-34 -34 72 72" aria-hidden="true">${ISS_ART}</svg>`;
  if (!passes.length) return `<div class="wx-orb">${art}<p><b>Space station</b><span>Not visible from here in the next 10 days.</span></p></div>`;
  const p = passes[0];
  const height = p.maxEl >= 60 ? 'almost overhead' : p.maxEl >= 30 ? 'high in the sky' : 'low in the sky';
  const now = p.start <= Date.now();
  const length = Math.max(1, Math.round((p.end - p.start) / 60e3));
  return `<div class="wx-orb">${art}<p>
    <b>${now ? 'Space station overhead now' : `Space station ${when(p.start, tz).replace(/^(Tonight|Today|Tomorrow)/, w => w.toLowerCase())}`}</b>
    <span>${p.from === p.to ? `In the ${p.from}` : `From ${p.from} to ${p.to}`}, ${height}. Visible for ${length} minute${length === 1 ? '' : 's'}.</span></p></div>`;
}

function launchView(launches, tz) {
  if (!launches?.length) return '';
  return `<ul class="wx-launches">${launches.map(l => {
    const exact = ['SEC', 'MIN', 'HR'].includes(l.precision);
    const time = exact ? when(l.net, tz) : `Around ${at(l.net, tz, { month: 'short', day: 'numeric' })}`;
    return `<li><b>${l.mission || l.rocket || 'Mission not announced'}</b>${l.near ? '<em>Near you</em>' : ''}
      <span>${l.mission && l.rocket ? `${l.rocket} from ` : 'From '}${l.place}</span><span>${time}</span></li>`;
  }).join('')}</ul>`;
}

// Each part shows up as soon as its data arrives
let spaceRun = 0;
function renderSpace(city, tz) {
  const run = ++spaceRun;
  const parts = { iss: '', launches: '' };
  const show = () => {
    if (run !== spaceRun) return;
    $('#wx-space').innerHTML = parts.iss + parts.launches;
    $('#wx-space-title').hidden = !$('#wx-space').innerHTML;
  };
  issPasses(city.lat, city.lon).then(p => { parts.iss = issView(p, tz); show(); }, () => {});
  upcomingLaunches(city.lat, city.lon).then(l => { parts.launches = launchView(l, tz); show(); }, () => {});
}

function render(city, w) {
  south = city.lat < 0;
  const c = w.current;
  const [label, sky] = code(c.weather_code);
  const isDay = !!c.is_day;
  const theme = (sky === 'sun' || sky === 'partly') && !isDay ? 'night' : sky;
  const root = $('#weather');
  root.dataset.sky = theme;
  document.querySelector('meta[name=theme-color]').content = getComputedStyle(root).getPropertyValue('--sky').trim();

  const u = prefs.unit === 'C' ? 'km/h' : 'mph';
  $('#wx-city').textContent = city.name;
  $('#wx-date').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  $('#wx-art').innerHTML = artSvg(sky, isDay);
  const temp = `${Math.round(c.temperature_2m)}°`;
  $('#wx-temp').textContent = temp;
  $('#wx-temp').classList.toggle('long', temp.length > 3); // e.g. 104° or -12°
  $('#wx-summary').textContent = `${label}. Feels like ${Math.round(c.apparent_temperature)}°.`;
  $('#wx-hilo').textContent = `High ${Math.round(w.daily.temperature_2m_max[0])}°, low ${Math.round(w.daily.temperature_2m_min[0])}°`;
  $('#wx-wind').textContent = `${Math.round(c.wind_speed_10m)} ${u}`;
  $('#wx-hum').textContent = `${c.relative_humidity_2m}%`;
  $('#wx-uv').textContent = Math.round(w.daily.uv_index_max[0] ?? 0);

  const nowIdx = Math.max(0, w.hourly.time.findIndex(t => t >= c.time.slice(0, 13)));
  $('#wx-line').innerHTML = dayLine(w, nowIdx);
  $('#wx-line').scrollLeft = 0;

  const lo = Math.min(...w.daily.temperature_2m_min), hi = Math.max(...w.daily.temperature_2m_max);
  $('#wx-daily').innerHTML = w.daily.time.map((t, i) => {
    const day = i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString([], { weekday: 'long' });
    const min = w.daily.temperature_2m_min[i], max = w.daily.temperature_2m_max[i];
    const left = ((min - lo) / (hi - lo || 1)) * 100, width = ((max - min) / (hi - lo || 1)) * 100;
    const [dl, ds] = code(w.daily.weather_code[i]);
    return `<li><span class="d">${day}</span><span class="g" title="${dl}">${glyph(ds)}</span>
      <span class="lo">${Math.round(min)}°</span><span class="bar"><i style="left:${left}%;width:${Math.max(width, 8)}%"></i></span>
      <span class="hi">${Math.round(max)}°</span></li>`;
  }).join('');
  $('#wx-sky').innerHTML = skyView(w);
  $('#wx-sky-title').hidden = !$('#wx-sky').innerHTML;
  renderSpace(city, w.timezone);
  $('#wx-unit').textContent = `°${prefs.unit}`;
}

async function load(city) {
  prefs.city = city;
  savePrefs();
  try {
    const w = await fetchWeather(city);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ city, w, unit: prefs.unit }));
    render(city, w);
  } catch {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.unit === prefs.unit) render(cached.city, cached.w);
    else $('#wx-summary').textContent = "Can't reach the weather service. Check your connection.";
  }
}

function locate() {
  if (!navigator.geolocation) return load(prefs.city || DEFAULT_CITY);
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      load({ name: await reverseName(lat, lon), lat, lon });
    },
    () => load(prefs.city || DEFAULT_CITY),
    { timeout: 8000, maximumAge: 600000 },
  );
}

function showResults(list) {
  const ul = $('#wx-results');
  if (!list.length) {
    ul.innerHTML = '<li class="empty">No places with that name. Check the spelling.</li>';
  } else {
    ul.innerHTML = list.map((c, i) => `<li><button type="button" data-i="${i}">${c.name}</button></li>`).join('');
    ul.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      ul.hidden = true;
      load(list[+b.dataset.i]);
    }));
  }
  ul.hidden = false;
}

// `onQuery(text)` is called first for every search. If it returns true the text
// was handled (e.g. it was the secret code) and is never sent to the network.
export function initWeather({ onQuery }) {
  const form = $('#wx-search');
  const input = $('#wx-q');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const q = input.value.trim();
    input.blur();
    if (!q) return;
    if (await onQuery(q)) {
      input.value = '';
      $('#wx-results').hidden = true;
      return;
    }
    // Our own suggestions first (they forgive typos), then anything else Open-Meteo knows
    const local = suggest(q);
    const remote = (await geocode(q)).filter(r => !local.some(l =>
      Math.abs(l.lat - r.lat) < 0.15 && Math.abs(l.lon - r.lon) < 0.15 && l.name.split(',')[0] === r.name.split(',')[0]));
    showResults([...local, ...remote].slice(0, 6));
  });

  // Suggestions while typing come from the bundled place list, so nothing typed here
  // (including the secret code) goes over the network before Enter is pressed.
  let typing;
  input.addEventListener('focus', loadPlaces, { once: true });
  input.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(async () => {
      if (!input.value.trim()) { $('#wx-results').hidden = true; return; }
      await loadPlaces();
      const list = suggest(input.value);
      if (list.length) showResults(list); else $('#wx-results').hidden = true;
    }, 80);
  });

  $('#wx-locate').addEventListener('click', locate);
  $('#wx-unit').addEventListener('click', () => {
    prefs.unit = prefs.unit === 'F' ? 'C' : 'F';
    load(prefs.city || DEFAULT_CITY);
  });

  // "/" focuses search on desktop, like most web apps
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== input && !$('#weather').hidden) {
      e.preventDefault();
      input.focus();
    }
  });

  // Show cached weather instantly, then refresh
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  if (cached && cached.unit === prefs.unit) render(cached.city, cached.w);
  if (prefs.city) load(prefs.city); else locate();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && prefs.city) load(prefs.city);
  });
}
