// The disguise: a real, working weather app powered by Open-Meteo (free, no API key).

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

function art(sky, isDay) {
  const sun = `<path d="${BLOB}"/>`;
  const cloud = `<path d="${CLOUD}"/>`;
  switch (sky) {
    case 'sun':
      return isDay
        ? print(sun, '#ffc93c', '#ff8e72') + eyes(0, -2)
        : print(`<path d="M18-50a52 52 0 1 0 34 72A44 44 0 0 1 18-50z"/>`, '#ffe7a3', '#ff8e72') + eyes(-10, 4, true);
    case 'partly':
      return `<g transform="translate(-28 -34) scale(.8)">${print(isDay ? sun : '<circle r="48"/>', isDay ? '#ffc93c' : '#ffe7a3', '#ff8e72')}</g>
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
    + '&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max'
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

function render(city, w) {
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
    showResults(await geocode(q));
  });
  input.addEventListener('input', () => { if (!input.value) $('#wx-results').hidden = true; });

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
