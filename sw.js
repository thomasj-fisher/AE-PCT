// FILE: sw.js
// PURPOSE: PWA service worker — caches the app shell so the page opens with no
//   signal. Tile servers are never intercepted (always network).
// SOURCE: —
// CAVEATS:
//   - Strategy is network-first for same-origin GETs; cache is offline fallback.
//   - Bump the CACHE constant on every shell file change. Old caches get pruned
//     in activate. iOS Safari may need TWO reloads for the new SW to take over.

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
