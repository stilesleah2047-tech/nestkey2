/* NestKey — simple app-shell cache. Network-first for API, cache-first for shell. */
var CACHE = 'nestkey-v50';
var SHELL = ["/", "/browse", "/post", "/services", "/account", "/dashboard", "/admin", "/privacy", "/cookies", "/about", "/contact", "/blog", "/assets/styles.css", "/assets/app.js", "/assets/footer.js", "/assets/config.js", "/assets/logo-96.png", "/assets/hero-bg.svg", "/manifest.webmanifest", "/property"];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.pathname.indexOf('/api/') === 0) {
    // Network-first for API calls.
    e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
    return;
  }
  // Pages (HTML navigations): network-first, so visitors always get the latest
  // version and server-rendered listing pages; fall back to cache when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(function (res) {
      if (res && res.ok && url.origin === location.origin && url.pathname.indexOf('/property/') !== 0) {
        var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () { return caches.match(e.request).then(function (hit) { return hit || caches.match('/'); }); }));
    return;
  }
  // Cache-first for static assets (CSS, JS, images).
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
