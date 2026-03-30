const CACHE_NAME = 'rafiq-cache-v1.1.0'; // تغيير النسخة لإجبار المتصفح على التحديث
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/data/adhkar.json',
  './assets/data/benefits.json',
  './assets/data/learning.json',
  './assets/data/resources.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
