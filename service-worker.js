const CACHE_NAME = 'rafiq-cache-v0.6.3';
const ASSETS = ['./', './index.html', './assets/css/styles.css?v=0.6.3', './assets/js/app.js?v=0.6.3'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => {
    return Promise.all(keys.map((k) => {
      if (k !== CACHE_NAME) return caches.delete(k); // مسح 0.5.1 نهائياً
    }));
  }).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});
