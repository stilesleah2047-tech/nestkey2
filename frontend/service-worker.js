/* NestKey — simple app-shell cache. Network-first for API, cache-first for shell. */
var CACHE = 'nestkey-v32';
var SHELL = ["/", "/index.html", "/browse.html", "/post.html", "/services.html", "/account.html", "/dashboard.html", "/admin.html", "/privacy.html", "/cookies.html", "/about.html", "/contact.html", "/blog.html",  "/assets/styles.css", "/assets/app.js", "/assets/config.js", "/assets/logo.png", "/assets/hero-bg.svg", "/manifest.webmanifest","/property.html"];

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
  // Cache-first for the app shell / static assets.
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
