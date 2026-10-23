// City suggestions as you type, matched on the phone against a bundled list of places
// (data/places.tsv, from GeoNames). Nothing is sent anywhere while typing, which matters
// because the secret code is typed into this same search box.
// Forgives half-typed names and spelling mistakes ("orlnado", "chcago", "miami fl").

let places = null;
let loading = null;

export function loadPlaces() {
  return loading ||= fetch('data/places.tsv')
    .then(r => r.ok ? r.text() : '')
    .then(text => {
      places = text.split('\n').filter(Boolean).map(line => {
        const [name, ascii, region, code, lat, lon, pop] = line.split('\t');
        return { name, region, code: code.toLowerCase(), lat: +lat, lon: +lon, pop: +pop, key: norm(ascii || name), regionKey: norm(region) };
      });
      regionNames = new Set(places.flatMap(p => [p.code, p.regionKey]));
    })
    .catch(() => { loading = null; });
}

let regionNames = new Set();

// Lowercase, no accents or punctuation, and common abbreviations spelled one way
const WORDS = { saint: 'st', fort: 'ft', mount: 'mt', mountain: 'mtn', north: 'n', south: 's', east: 'e', west: 'w' };
function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[.'’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    .split(' ').map(w => WORDS[w] || w).join(' ');
}

// Edit distance, counting a swap of two neighboring letters as one mistake
function typos(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

// How well a place name matches what's been typed so far. Lower is better; null is no match.
function score(key, q) {
  if (key.startsWith(q)) return 0;
  if (key.includes(' ' + q)) return 1;
  const max = q.length < 4 ? 0 : q.length < 7 ? 1 : 2;
  if (!max) return null;
  if (key[0] !== q[0] && key[1] !== q[1]) return null; // skip the slow part when the start doesn't line up at all
  // Compare against the start of the name, a little shorter or longer, since the word may be unfinished
  let d = max + 1;
  for (let len = q.length - max; len <= q.length + max; len++) d = Math.min(d, typos(q, key.slice(0, len), max));
  return d <= max ? 1 + d : null;
}

// "springfield il", "paris, france" and "orlando florida" narrow by state or country
function splitRegion(q) {
  const comma = q.indexOf(',');
  if (comma > 0) return [norm(q.slice(0, comma)), norm(q.slice(comma + 1))];
  const words = norm(q).split(' ');
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const tail = words.slice(-n).join(' ');
    if (regionNames.has(tail)) return [words.slice(0, -n).join(' '), tail];
  }
  return [words.join(' '), ''];
}

export function suggest(text, limit = 6) {
  if (!places) return [];
  const [q, region] = splitRegion(text);
  if (q.length < 2) return [];
  const hits = [];
  for (const p of places) {
    if (region && p.code !== region && !p.regionKey.startsWith(region)) continue;
    const s = score(p.key, q);
    if (s !== null) hits.push([s, p]);
  }
  // Best match first, then bigger places; a big city with one typo still beats a tiny exact one
  hits.sort((a, b) => (a[0] - Math.log10(a[1].pop + 1) / 2) - (b[0] - Math.log10(b[1].pop + 1) / 2));
  return hits.slice(0, limit).map(([, p]) => ({
    name: `${p.name}, ${p.region}`, lat: p.lat, lon: p.lon,
  }));
}
