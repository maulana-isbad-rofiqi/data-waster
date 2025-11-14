const CACHE_NAME = 'data-waster-v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS.filter(Boolean))));
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', evt => {
  // Don't serve cached logs.txt; always fetch fresh
  if (evt.request.url.includes('/api/logs') || evt.request.url.endsWith('logs.txt')) {
    evt.respondWith(fetch(evt.request).catch(() => caches.match(evt.request)));
    return;
  }

  evt.respondWith(
    caches.match(evt.request).then(cached => {
      return cached || fetch(evt.request).then(response => {
        // optionally update cache for GET HTML/CSS/JS
        if (evt.request.method === 'GET' && response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(evt.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
