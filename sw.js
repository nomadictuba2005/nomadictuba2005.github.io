// Offline support: the app opens from its cache instantly and refreshes it in the background. Weather API calls always go to the network.
const VERSION = 'breeze-v25';
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
  'js/lang/zh.js',
  'js/lang/fr.js',
  'js/lang/vi.js',
  'js/lang/hi.js',
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
  // 'no-cache' makes the browser check with the server instead of reusing a copy up to 10 minutes old.
  const fresh = () => fetch(e.request.mode === 'navigate'
    ? new Request(e.request.url, { cache: 'no-cache' })
    : new Request(e.request, { cache: 'no-cache' }));

  // The ISS and launch feed changes every 2 hours, so it stays network first
  if (url.pathname.endsWith('/data/space.json')) {
    e.respondWith(fresh()
      .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }

  // Everything else opens straight from the cache, so a slow or flaky connection never holds up the
  // weather screen. A fresh copy is fetched in the background for next time. New releases still
  // arrive whole, because bumping VERSION installs a complete new cache.
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const update = fresh().then(res => { if (res.ok) c.put(e.request, res.clone()); return res; });
    if (hit) {
      e.waitUntil(update.catch(() => {}));
      return hit;
    }
    return update.catch(() => c.match('index.html'));
  }));
});
