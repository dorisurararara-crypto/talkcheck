/**
 * service-worker.js — PWA 오프라인 캐시
 */

const CACHE_NAME = 'talkcheck-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/parser.js',
  '/js/analyzer.js',
  '/js/ui.js',
  '/js/analytics.js',
  '/pwa/manifest.json',
  '/favicon.svg',
];

// 설치: precache
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch: Cache-first, 실패 시 네트워크
self.addEventListener('fetch', (event) => {
  // analytics 요청은 캐시 제외 (GoatCounter 등)
  const url = new URL(event.request.url);
  if (url.hostname !== self.location.hostname) {
    return; // 외부 요청은 그냥 통과
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
