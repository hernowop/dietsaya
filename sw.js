const CACHE_NAME = 'dietsaya-v7';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Jangan pernah cache permintaan ke backend Google Apps Script, Google APIs, atau skrip JS aplikasi
  if (url.includes('script.google.com') || url.includes('googleapis.com') || e.request.method === 'POST' || url.includes('/js/')) {
    return;
  }

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

