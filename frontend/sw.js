const CACHE_NAME = 'trat-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/css/styles.css',
  '/static/js/app.js',
  '/static/js/api.js',
  '/static/js/react-config.js',
  '/static/js/components/Navbar.js',
  '/static/js/components/ShareCardModal.js',
  '/static/js/pages/AuthPage.js',
  '/static/js/pages/Dashboard.js',
  '/static/js/pages/DietPage.js',
  '/static/js/pages/StudyPage.js',
  '/static/js/pages/AnalyticsPage.js',
  '/static/js/lib/react.min.js',
  '/static/js/lib/react-dom.min.js',
  '/static/js/lib/htm.umd.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests and local origin calls
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // For API endpoints: Network first, cache fallback
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  
  // For standard resources: Cache first, Network fallback with background update
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Try to update cache in background
        fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
