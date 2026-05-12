// Service worker for Athena's PCT tracker
// Network-first strategy for the app shell: when online, the latest version
// always wins (no stale HTML/JS mismatches). Cache is the offline fallback.
// Tile requests are never intercepted — they always go to network.

const CACHE = 'pct-tracker-v3';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './data/trail-data.js',
  './data/waypoints-data.js',
  './data/water-waypoints.js',
  './data/water-loader.js',
  './data/progress.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // addAll fails the whole install if any single fetch fails — use individual catches
      Promise.all(APP_SHELL.map((url) =>
        c.add(url).catch(() => null)
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Map tiles: never intercept.
  if (
    url.hostname.endsWith('tile.openstreetmap.org') ||
    url.hostname.endsWith('tile.opentopomap.org')
  ) {
    return;
  }

  // Network-first for everything else: fetch the latest, fall back to cache offline.
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
