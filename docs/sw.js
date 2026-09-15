/**
 * 최소 서비스워커 — 앱 셸 캐싱, 오프라인 동작용.
 * ponytail: 캐시 무효화는 CACHE_NAME 버전 문자열만 올리면 됨(수동). 빌드 도구 없음.
 */
var CACHE_NAME = 'jobscale-v13';
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/style.css',
  './js/strings.ko.js',
  './js/i18n.js',
  './js/score.js',
  './js/shareParse.js',
  './js/app.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        return res;
      }).catch(function () { return cached; });
    })
  );
});
