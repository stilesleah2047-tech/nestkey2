/* NestKey — simple app-shell cache. Network-first for API, pages, CSS and JS; cache-first for images.
   Bump CACHE whenever you want every installed copy to drop its old files at once. */
var CACHE = 'nestkey-v51';
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
  // CSS and JS from our own site: network-first, so an update reaches everyone straight
  // away (cache-first kept serving old code until CACHE was bumped). Cached copy is the
  // offline fallback.
  if (url.origin === location.origin && /\.(js|css)$/.test(url.pathname)) {
    e.respondWith(fetch(e.request).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return caches.match(e.request); }));
    return;
  }
  // Images and other static files: cache-first.
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
