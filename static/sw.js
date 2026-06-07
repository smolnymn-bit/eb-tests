const CACHE_NAME = 'eb-tests-v1';
const PRECACHE_ASSETS = [
  '/',
  '/static/css/main.css',
  '/static/css/fontawesome.all.min.css',
  '/static/js/main.js',
  '/static/img/favicon.png',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png',
  '/static/manifest.json',
  '/static/sounds/correct.mp3',
  '/static/sounds/wrong.mp3',
  '/static/webfonts/fa-solid-900.woff2',
  '/static/webfonts/fa-regular-400.woff2',
  '/static/webfonts/fa-brands-400.woff2',
  '/static/webfonts/fa-v4compatibility.woff2',
];

// Установка: кэшируем основные файлы
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Активация: удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Обслуживание запросов: кэш-первый, сеть-второй
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(response => {
        if (response && response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return response;
      });
    })
  );
});