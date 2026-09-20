/**
 * 최소 서비스워커 — 앱 셸 캐싱, 오프라인 동작용.
 * 네트워크 우선 + 캐시 폴백. 온라인이면 항상 최신, 오프라인이면 마지막 캐시본.
 */
var CACHE_NAME = 'jobscale-v17';
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
  var url = new URL(event.request.url);
  // 네트워크 우선 — 캐시 우선이면 배포해도 다음 실행까지 옛 화면이 떠서, 버전만 올리는
  // 방식으로는 이 지연이 안 없어진다. 캐시는 오프라인 대비용으로만 쓴다.
  event.respondWith(
    fetch(event.request).then(function (res) {
      if (res.ok && url.origin === self.location.origin && !url.search) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        // 공유로 들어온 주소(?title=...)는 캐시에 없으니 앱 셸로 떨어뜨린다.
        return cached || caches.match('./index.html');
      });
    })
  );
});
