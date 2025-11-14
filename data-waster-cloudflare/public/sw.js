self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => {
  // Always try network for API routes to avoid stale logs
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 502 })));
    return;
  }
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
