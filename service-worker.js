
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open('rafiq-cache-v1').then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/offline.html',
      '/manifest.webmanifest',
      '/css/styles.css',
      '/js/app.js',
      '/js/adhkar.json',
      '/assets/icons/icon-192.png',
      '/assets/icons/icon-512.png'
    ]))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!=='rafiq-cache-v1').map(k=>caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Try cache-first for app shell
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request).catch(()=> caches.match('/offline.html')))
    );
  } else {
    // Network-first for external
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open('rafiq-cache-v1').then(c=> c.put(e.request, clone));
        return res;
      }).catch(()=> caches.match(e.request))
    );
  }
});
