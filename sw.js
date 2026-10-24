// Offline support: cache the app shell. Weather API calls always go to the network.
const VERSION = 'breeze-v19';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/weather.js',
  'js/vault.js',
  'js/hub.js',
  'js/setup.js',
  'js/icons.js',
  'js/content.js',
  'js/i18n.js',
  'js/local.js',
  'js/config.js',
  'js/space.js',
  'js/vendor/satellite.js',
  'js/places.js',
  'js/climate.js',
  'data/climate.json',
  'data/places.tsv',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/icon-maskable-512.png',
  'icons/favicon-32.png',
  'fonts/bagel-fat-one.woff2',
  'fonts/atkinson-400.woff2',
  'fonts/atkinson-700.woff2',
];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache (GitHub Pages lets it keep files 10 minutes),
  // so a new version never gets stocked with old files
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network first so updates show up, falling back to the cache when offline.
  // 'no-cache' makes the browser check with the server instead of reusing a copy up to 10 minutes old.
  const fresh = e.request.mode === 'navigate'
    ? new Request(e.request.url, { cache: 'no-cache' })
    : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(fresh)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))),
  );
});
