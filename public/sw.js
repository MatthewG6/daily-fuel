const VERSION = 'daily-fuel-v1';
const BASE = new URL('./', self.location.href).href;
const PRECACHE = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(PRECACHE.map(path => new URL(path, BASE).href))));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('daily-fuel-') && key !== VERSION).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin || !request.url.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(VERSION).then(cache => cache.put(new URL('index.html', BASE).href, copy))); }
      return response;
    }).catch(() => caches.match(new URL('index.html', BASE).href)));
  } else {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(VERSION).then(cache => cache.put(request, copy))); }
      return response;
    })));
  }
});
