/* ============================================================
   AniTier Mobile вЂ” service worker
   РљРµС€РёСЂСѓРµС‚ РѕР±РѕР»РѕС‡РєСѓ РїСЂРёР»РѕР¶РµРЅРёСЏ. API-Р·Р°РїСЂРѕСЃС‹ РёРґСѓС‚ С‚РѕР»СЊРєРѕ РІ СЃРµС‚СЊ.
   ============================================================ */
'use strict';

const CACHE = 'anitier-mobile-v31';
const SHELL = [
  './',
  './index.html',
  './mobile.css',
  './mobile.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  '../styles.css',
  '../core.js',
  '../app-store.js',
  '../app-api.js',
  '../app-render.js',
  '../app.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms);
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      Promise.race([fetch(request), timeout(5000)])
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put('./index.html', copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then(cached => cached || caches.match('./index.html', { ignoreSearch: true }))),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});
