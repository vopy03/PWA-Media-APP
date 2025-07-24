const CACHE_NAME = 'local-media-cache-v2';
const CACHE_URLS = [
  './',
  './index.html',
  './profile.html',
  './video.html',
  './style.css',
  './main.js',
  './profile.js',
  './videocatalog.js',
  './filesystem.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './service-worker.js', // для контролю версії
];

// Встановлення Service Worker та кешування
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching files:', CACHE_URLS);
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Активація Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Обробка fetch-запитів
self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Не кешуємо сторонні ресурси
  if (!url.startsWith(self.location.origin)) {
    console.log('[SW] IGNORE external:', url);
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      // Якщо є в кеші — повертаємо
      if (response) {
        console.log('[SW] CACHE HIT:', url);
        return response;
      }
      // Якщо немає — пробуємо з мережі, і додаємо в кеш
      console.log('[SW] CACHE MISS, fetching:', url);
      return fetch(event.request).then(fetchResp => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchResp.clone());
          console.log('[SW] Cached new file:', url);
          return fetchResp;
        });
      }).catch(() => {
        // Fallback: якщо це навігаційний запит — повертаємо index.html
        if (event.request.mode === 'navigate') {
          console.log('[SW] OFFLINE fallback to index.html');
          return caches.match('./index.html');
        }
        console.log('[SW] OFFLINE, no fallback for:', url);
      });
    })
  );
});
