// A believable forecast for when the weather service can't be reached, so the app never looks
// broken. It's built from what the weather is usually like at this time of year at the nearest
// place in data/climate.json (made by .github/scripts/climate-data.mjs). The same place and day
// always come out the same, so it doesn't jump around every time the app opens.
// The result has the same shape as an Open-Meteo forecast, so the screen draws it the usual way.

let points = null;
let loading = null;
const loadClimate = () => loading ||= fetch('data/climate.json')
  .then(r => r.ok ? r.json() : null)
  .then(j => (points = j))
  .catch(() => { loading = null; return null; });

const RAD = Math.PI / 180;
const km = (lat1, lon1, lat2, lon2) => {
  const h = Math.sin((lat2 - lat1) * RAD / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin((lon2 - lon1) * RAD / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const nearest = (lat, lon) => points.reduce((best, p) => km(lat, lon, p[0], p[1]) < km(lat, lon, best[0], best[1]) ? p : best);

// Typical values for a day, blended with the neighboring month so they change smoothly
// [high °C, low °C, humidity %, wind km/h, cloud %, then % of days clear/partly/overcast/fog/rain/snow/storm]
function normals(months, date) {
  const m = date.getUTCMonth();
  const len = new Date(Date.UTC(date.getUTCFullYear(), m + 1, 0)).getUTCDate();
  const pos = (date.getUTCDate() - 0.5) / len - 0.5;
  const other = months[(m + (pos < 0 ? 11 : 1)) % 12];
  return months[m].map((v, i) => v + (other[i] - v) * Math.abs(pos));
}

// Repeatable random numbers from a text seed
function random(seed) {
  let h = 1779033703;
  for (const c of seed) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; }
  return () => {
    h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Sunrise and sunset (as UTC times) for the day starting at `day` (UTC midnight of that date)
function sunTimes(lat, lon, day) {
  const doy = (day - Date.UTC(new Date(day).getUTCFullYear(), 0, 0)) / 864e5;
  const decl = 23.44 * RAD * Math.sin(2 * Math.PI * (284 + doy) / 365);
  const b = 2 * Math.PI * (doy - 81) / 364;
  const noon = 720 - 4 * lon - (9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b));
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
  const half = cosH >= 1 ? 0 : cosH <= -1 ? 719 : Math.acos(cosH) / RAD * 4; // polar night or midnight sun
  return { rise: day + (noon - half) * 6e4, set: day + (noon + half) * 6e4, decl: decl / RAD };
}

// Feels-like temperature: halfway to the Australian apparent temperature, since without sunshine
// and gusts to go on, the full formula overstates muggy and windy days
const feelsLike = (t, hum, windKmh) => t + (0.33 * (hum / 100 * 6.105 * Math.exp(17.27 * t / (237.7 + t))) - 0.7 * windKmh / 3.6 - 4) / 2;

// The place's time zone, guessed from its longitude, plus an hour of daylight saving outside the
// tropics (mid March to early November up north, October to March down south).
// Uses the phone's own zone when the guess matches it, so the zone's name shows normally.
export function offsetFor(lat, lon) {
  const now = new Date(), m = now.getMonth(), d = now.getDate();
  const summer = lat > 25 ? (m > 2 && m < 10) || (m === 2 && d >= 10) || (m === 10 && d < 3)
    : lat < -25 ? m >= 9 || m <= 2 : false;
  const off = (Math.round(lon / 15) + (summer ? 1 : 0)) * 60;
  const phone = -now.getTimezoneOffset();
  const tz = off === phone ? Intl.DateTimeFormat().resolvedOptions().timeZone : `Etc/GMT${off <= 0 ? '+' : '-'}${Math.abs(off / 60)}`;
  return { off, tz };
}

const CLOUD = [8, 40, 88, 100, 92, 92, 85];

export async function estimate(city, unit) {
  if (!(await loadClimate())?.length) return null;
  const months = nearest(city.lat, city.lon)[2];
  const { off, tz } = offsetFor(city.lat, city.lon);
  const local = ms => new Date(ms + off * 6e4).toISOString().slice(0, 16);
  const today = new Date(Date.now() + off * 6e4);
  const place = `${city.lat.toFixed(1)},${city.lon.toFixed(1)}`;

  const days = [];
  for (let i = -1; i < 8; i++) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
    const key = date.toISOString().slice(0, 10);
    const [hi, lo, hum, wind, , ...kinds] = normals(months, date);
    const r = random(place + key), before = random(place + new Date(+date - 864e5).toISOString().slice(0, 10));
    const swing = (r() + before() - 1) * 4; // up to 4° off normal, carried over from the day before
    let pick = r() * kinds.reduce((a, b) => a + b, 0), kind = 0;
    while (kind < 6 && (pick -= kinds[kind]) > 0) kind++;
    const wet = kind >= 4;
    const max = hi + swing - (wet ? 1.5 : 0) + (kind === 0 ? 1 : 0);
    const min = lo + swing * 0.7 + (kind === 2 || wet ? 1 : 0);
    if (kind === 5 && min > 1) kind = 4; // too warm for snow
    if (kind === 4 && max < 0) kind = 5;
    const code = [r() < 0.5 ? 0 : 1, 2, 3, 45, [61, 63, 80, 53][Math.floor(r() * 4)], [71, 73, 85][Math.floor(r() * 3)], 95][kind];
    const sun = sunTimes(city.lat, city.lon, +date);
    const uv = Math.max(0, 12.5 * Math.cos(Math.min(89, Math.abs(city.lat - sun.decl)) * RAD) ** 2.5) * [1, 0.85, 0.45, 0.5, 0.35, 0.4, 0.35][kind];
    days.push({ key, max, min, kind, code, hum, wind: wind * (0.7 + r() * 0.6), uv, ...sun, start: +date - off * 6e4 });
  }

  // Temperature through the week: coolest at sunrise, warmest around 3pm, eased in between
  const anchors = days.flatMap(d => [[(d.rise - days[1].start) / 36e5, d.min], [(d.start - days[1].start) / 36e5 + 15, d.max]]);
  const tempAt = h => {
    const k = anchors.findIndex(a => a[0] > h);
    if (k < 0) return anchors.at(-1)[1];
    const [a, b] = k > 0 ? [anchors[k - 1], anchors[k]] : [anchors[0], anchors[1]];
    return a[1] + (b[1] - a[1]) * (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))))) / 2;
  };

  const week = days.slice(1, 8);
  const hourly = { time: [], temperature_2m: [], weather_code: [], is_day: [], cloud_cover: [] };
  for (const [i, d] of week.entries()) {
    const r = random(place + d.key + 'hours');
    for (let h = 0; h < 24; h++) {
      const ms = d.start + h * 36e5;
      hourly.time.push(local(ms));
      hourly.temperature_2m.push(tempAt(i * 24 + h));
      hourly.weather_code.push(d.kind >= 4 && r() < 0.45 ? 3 : d.code); // wet days aren't wet every hour
      hourly.is_day.push(ms >= d.rise && ms < d.set ? 1 : 0);
      hourly.cloud_cover.push(Math.min(100, Math.max(0, Math.round(CLOUD[d.kind] + (r() - 0.5) * 24))));
    }
  }

  const nowH = (Date.now() - week[0].start) / 36e5;
  const h = Math.floor(nowH);
  const temp = tempAt(nowH);
  const hum = Math.round(Math.min(100, Math.max(12, week[0].hum + ((week[0].max + week[0].min) / 2 - temp) * 2)));
  const F = unit === 'F', t = c => F ? c * 9 / 5 + 32 : c, speed = k => F ? k * 0.621371 : k;
  return {
    timezone: tz,
    utc_offset_seconds: off * 60,
    current: {
      time: local(Date.now() - Date.now() % 9e5), temperature_2m: t(temp), relative_humidity_2m: hum,
      apparent_temperature: t(feelsLike(temp, hum, week[0].wind)), weather_code: hourly.weather_code[h],
      wind_speed_10m: speed(week[0].wind), is_day: hourly.is_day[h],
    },
    hourly: { ...hourly, temperature_2m: hourly.temperature_2m.map(t) },
    daily: {
      time: week.map(d => d.key), weather_code: week.map(d => d.code),
      temperature_2m_max: week.map(d => t(d.max)), temperature_2m_min: week.map(d => t(d.min)),
      uv_index_max: week.map(d => Math.round(d.uv * 10) / 10),
      sunrise: week.map(d => local(d.rise)), sunset: week.map(d => local(d.set)),
      daylight_duration: week.map(d => (d.set - d.rise) / 1000),
    },
  };
}
