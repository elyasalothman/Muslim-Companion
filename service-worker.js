const CACHE = 'rafiq-fast-cache-20260329-072118';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/config.json',
  './assets/img/logo.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './data/adhkar.json',
  './data/resources.json',
  './data/learning.json'
];
self.addEventListener('install', (e)=>{ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate', (e)=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', (e)=>{ e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).catch(()=>caches.match('./index.html')))); });
