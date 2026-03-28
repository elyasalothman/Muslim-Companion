
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open('rafiq-cache-v1').then((cache) => cache.addAll([
      './',
      './index.html',
      './offline.html',
      './manifest.webmanifest',
      './styles.css',
      './app.js',
      './adhkar.json',
      './icon-192.png',
      './icon-512.png'
    ]))
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys=> Promise.all(keys.filter(k=>k!=='rafiq-cache-v1').map(k=>caches.delete(k)))));
});
self.addEventListener('fetch', (e)=>{
  e.respondWith(
    caches.match(e.request).then(res=> res || fetch(e.request).catch(()=> caches.match('./offline.html')))
  );
});
