(function () {
  'use strict';
  var API = '';
  var ROOM_RATE = 100;

  // Inline "no photo" tile (local SVG data URI) — no external example images.
  var NOPHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
    '<rect width="400" height="300" fill="#eef2f3"/>' +
    '<g fill="none" stroke="#b9c6cc" stroke-width="6">' +
    '<path d="M120 190l50-46 40 34 34-28 44 40"/><circle cx="150" cy="120" r="16"/></g>' +
    '<text x="200" y="250" font-family="sans-serif" font-size="18" fill="#8aa0a8" text-anchor="middle">No photo yet</text></svg>'
  );

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').catch(function () {});
    });
  }

  function money(n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); }
  function $(id) { return document.getElementById(id); }

  // Simple line icons (no emoji).
  function icon(name) {
    var p = {
      home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
      card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
      cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
      star: '<path d="M12 3l2.9 6 6.1.9-4.4 4.3 1 6.1L12 17.8 6.4 20.3l1-6.1L3 9.9 9.1 9z"/>',
      pin: '<path d="M12 21s-6-5.686-6-10a6 6 0 1112 0c0 4.314-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
      bed: '<path d="M3 18v-9h10a4 4 0 014 4v5"/><path d="M3 13h18"/><path d="M21 18v-2"/>',
      bath: '<path d="M4 12h16v3a4 4 0 01-4 4H8a4 4 0 01-4-4z"/><path d="M6 12V6a2 2 0 012-2"/>',
      tag: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="8" cy="8" r="1.5"/>'
    }[name] || '';
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }
  function api(path, opts) {
    return fetch(API + path, opts).then(function (r) { return r.json(); });
  }

  // ---- Auth (JWT in localStorage) ----
  function getToken() { try { return localStorage.getItem('hh_token'); } catch (e) { return null; } }
  function currentUser() { try { return JSON.parse(localStorage.getItem('hh_user') || 'null'); } catch (e) { return null; } }
  function setAuth(t, u) { try { localStorage.setItem('hh_token', t); localStorage.setItem('hh_user', JSON.stringify(u)); } catch (e) {} }
  function clearAuth() { try { localStorage.removeItem('hh_token'); localStorage.removeItem('hh_user'); } catch (e) {} }
  function authHeaders(extra) { var h = extra || {}; var t = getToken(); if (t) h['Authorization'] = 'Bearer ' + t; return h; }
  function updateNav() {
    var u = currentUser();
    // Admins don't post houses — hide those tabs everywhere.
    Array.prototype.forEach.call(document.querySelectorAll('.nav-post'), function (a) {
      a.style.display = (u && u.isAdmin) ? 'none' : '';
    });
    var el = $('navauth'); if (!el) return;
    if (u && u.isAdmin) {
      el.innerHTML = '<a href="/admin.html">Command Center</a>';
    } else if (u) {
      el.innerHTML = '<a href="/dashboard.html">Dashboard</a>';
    } else {
      el.innerHTML = '<a href="/account.html">Sign in</a>';
    }
  }
  updateNav();

  // Mobile hamburger — injected on every page so headers stay simple.
  function initNav() {
    var wrap = document.querySelector('.top .wrap'); if (!wrap) return;
    var nav = wrap.querySelector('nav'); if (!nav || wrap.querySelector('.nav-toggle')) return;
    var btn = document.createElement('button');
    btn.className = 'nav-toggle'; btn.setAttribute('aria-label', 'Menu'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open'); btn.classList.toggle('active', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) { nav.classList.remove('open'); btn.classList.remove('active'); } });
    wrap.appendChild(btn);
  }
  initNav();

  // Cookie consent banner.
  function initCookieConsent() {
    var KEY = 'nk_cookie_consent';
    try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }
    var bar = document.createElement('div');
    bar.className = 'cookie-bar';
    bar.innerHTML = '<div class="cookie-text">We use cookies to keep you signed in and improve NestKey. See our <a href="/cookies.html">Cookie Policy</a> and <a href="/privacy.html">Privacy Policy</a>.</div>' +
      '<div class="cookie-btns"><button class="btn ghost btn--sm" id="ck-decline">Essential only</button><button class="btn btn--sm" id="ck-accept">Accept</button></div>';
    document.body.appendChild(bar);
    setTimeout(function () { bar.classList.add('show'); }, 100);
    function done(v) { try { localStorage.setItem(KEY, v); } catch (e) {} bar.classList.remove('show'); setTimeout(function () { bar.remove(); }, 300); }
    bar.querySelector('#ck-accept').addEventListener('click', function () { done('accepted'); });
    bar.querySelector('#ck-decline').addEventListener('click', function () { done('essential'); });
  }
  initCookieConsent();

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 20);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 4000);
  }

  // Rating pop-up shown after a payment.
  function showRating(context) {
    if (document.getElementById('rate-modal')) return;
    var ov = document.createElement('div');
    ov.id = 'rate-modal'; ov.className = 'rate-modal open';
    ov.innerHTML = '<div class="rate-card"><button class="rate-x" aria-label="Close">&times;</button>' +
      '<h3>How was your experience?</h3><p class="dc-sub">Your feedback helps us improve NestKey.</p>' +
      '<div class="stars" id="rate-stars">' + [1, 2, 3, 4, 5].map(function (i) { return '<button data-s="' + i + '">\u2605</button>'; }).join('') + '</div>' +
      '<textarea id="rate-comment" placeholder="Anything you\u2019d like to tell us? (optional)"></textarea>' +
      '<button class="btn block" id="rate-send" disabled>Submit rating</button>' +
      '<div class="status" id="rate-status"></div></div>';
    document.body.appendChild(ov);
    var chosen = 0;
    var starsWrap = ov.querySelector('#rate-stars');
    Array.prototype.forEach.call(starsWrap.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        chosen = parseInt(b.getAttribute('data-s'), 10);
        Array.prototype.forEach.call(starsWrap.querySelectorAll('button'), function (x, i) { x.classList.toggle('on', i < chosen); });
        ov.querySelector('#rate-send').disabled = false;
      });
    });
    function close() { ov.remove(); }
    ov.querySelector('.rate-x').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#rate-send').addEventListener('click', function () {
      if (!chosen) return;
      fetch(API + '/api/ratings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stars: chosen, comment: ov.querySelector('#rate-comment').value, context: context || '' }) })
        .then(function () { var s = ov.querySelector('#rate-status'); s.className = 'status show ok'; s.textContent = 'Thank you!'; setTimeout(close, 1200); })
        .catch(function () { close(); });
    });
  }

  // ---- Locations (county → town) ----
  var LOCATIONS = null;

  // Reusable map pin picker (Leaflet). Writes lat/lng into hidden inputs.
  function initLocationPicker(o) {
    if (!window.L || !document.getElementById(o.mapId)) return null;
    var map = L.map(o.mapId).setView(o.center || [-1.286, 36.817], o.zoom || 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20, subdomains: 'abcd', attribution: '© OpenStreetMap, © CARTO' }).addTo(map);
    var marker = null;
    function status(msg) { var s = o.statusId && document.getElementById(o.statusId); if (s) s.textContent = msg; }
    function setVals(lat, lng) {
      document.getElementById(o.latId).value = (+lat).toFixed(6);
      document.getElementById(o.lngId).value = (+lng).toFixed(6);
      status('Pinned at ' + (+lat).toFixed(5) + ', ' + (+lng).toFixed(5) + ' — drag the pin to fine-tune.');
    }
    function place(lat, lng, zoom) {
      lat = +lat; lng = +lng; if (isNaN(lat) || isNaN(lng)) return;
      if (!marker) {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', function () { var p = marker.getLatLng(); setVals(p.lat, p.lng); });
      } else marker.setLatLng([lat, lng]);
      map.setView([lat, lng], zoom || 16);
      setVals(lat, lng);
    }
    map.on('click', function (e) { place(e.latlng.lat, e.latlng.lng); });
    if (o.geoBtnId) document.getElementById(o.geoBtnId).addEventListener('click', function () {
      if (!navigator.geolocation) { status('Geolocation not supported — click the map.'); return; }
      status('Getting your location…');
      navigator.geolocation.getCurrentPosition(
        function (pos) { place(pos.coords.latitude, pos.coords.longitude, 17); },
        function () { status('Could not get your location — click the map to drop a pin.'); }
      );
    });
    function parseCoords(t) {
      if (!t) return null;
      var g = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
      return g ? [parseFloat(g[1]), parseFloat(g[2])] : null;
    }
    if (o.setBtnId) document.getElementById(o.setBtnId).addEventListener('click', function () {
      var c = parseCoords(document.getElementById(o.pasteId).value);
      if (c) place(c[0], c[1], 16);
      else status("Couldn't read that. Paste coordinates like -1.2921, 36.8219 or a Google Maps link containing @lat,lng.");
    });
    setTimeout(function () { map.invalidateSize(); }, 200);
    return { place: place, recenter: function (c) { if (!marker && c) map.setView(c, 12); }, map: map };
  }

  function loadLocations() {
    if (LOCATIONS) return Promise.resolve(LOCATIONS);
    return fetch(API + '/api/locations').then(function (r) { return r.json(); }).then(function (d) { LOCATIONS = d || []; return LOCATIONS; });
  }
  // Fill a county field (input or select) + town suggestions. County is free-typed:
  // people can enter any county/town, our list is only suggestions.
  function wireCountyDatalist(countyEl, townInput, townDatalist, countyDatalist) {
    loadLocations().then(function (cs) {
      if (countyDatalist) countyDatalist.innerHTML = cs.map(function (c) { return '<option value="' + c.county + '">'; }).join('');
      else if (countyEl && countyEl.tagName === 'SELECT') countyEl.innerHTML = '<option value="">Select or type…</option>' + cs.map(function (c) { return '<option>' + c.county + '</option>'; }).join('');
      function fill() {
        var c = cs.filter(function (x) { return x.county.toLowerCase() === String(countyEl.value || '').toLowerCase(); })[0];
        var towns = c ? c.towns : [];
        if (townDatalist) townDatalist.innerHTML = towns.map(function (t) { return '<option value="' + t + '">'; }).join('');
      }
      countyEl.addEventListener('input', fill);
      countyEl.addEventListener('change', fill);
    });
  }
  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); var a = arguments, c = this; t = setTimeout(function () { fn.apply(c, a); }, ms); };
  }

  // Reusable Pesapal payment — loads the secure Pesapal page in an IFRAME on our
  // own site (no full-page redirect) and polls status. onDone('yes'|'failed').
  function openPesapal(iframeUrl, orderTrackingId, onDone) {
    var ov = document.getElementById('pp-modal');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'pp-modal';
      ov.className = 'pp-modal';
      ov.innerHTML =
        '<div class="pp-card"><div class="pp-head"><strong>Secure payment</strong>' +
        '<button type="button" class="pp-close" aria-label="Close">&times;</button></div>' +
        '<iframe id="pp-frame" title="Pesapal payment"></iframe>' +
        '<div class="pp-status" id="pp-status">Waiting for payment\u2026</div></div>';
      document.body.appendChild(ov);
    }
    var frame = ov.querySelector('#pp-frame');
    var statusEl = ov.querySelector('#pp-status');
    frame.src = iframeUrl;
    statusEl.textContent = 'Complete the payment in the window above\u2026';
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';

    var timer = null;
    function stop() { if (timer) { clearInterval(timer); timer = null; } ov.classList.remove('open'); document.body.style.overflow = ''; frame.src = 'about:blank'; }
    ov.querySelector('.pp-close').onclick = function () { stop(); };

    var n = 0;
    timer = setInterval(function () {
      n++;
      if (n > 60) { stop(); onDone('timeout'); return; } // ~5 min
      fetch(API + '/api/payments/pesapal/status/' + encodeURIComponent(orderTrackingId))
        .then(function (r) { return r.json(); })
        .then(function (s) {
          if (!s) return;
          if (s.status === 'yes') { stop(); onDone('yes'); }
          else if (s.status === 'failed') { statusEl.textContent = 'Payment failed — you can try another method.'; }
        }).catch(function () {});
    }, 5000);
  }

  api('/api/health').then(function (h) {
    if (h && h.roomRate) ROOM_RATE = h.roomRate;
    var db = $('dbName'); if (db && h) db.textContent = h.driver;
    if ($('post-form')) updateFee();
  }).catch(function () {});

  /* ---------------- Browse ---------------- */
  if ($('browse')) {
    var activeRegion = '';
    var activeCounty = '';

    // Read the county/town chosen on the front page.
    (function () {
      var p = new URLSearchParams(location.search);
      activeCounty = p.get('county') || '';
      activeRegion = (p.get('town') || '').toLowerCase();
      var deal0 = p.get('deal') || '';
      if (deal0 && $('deal')) $('deal').value = deal0;
      if (activeCounty || activeRegion) {
        var townLabel = p.get('town') || '';
        if ($('browse-title')) $('browse-title').textContent = 'Houses in ' + (townLabel || activeCounty);
        if ($('browse-sub')) $('browse-sub').textContent = townLabel && activeCounty ? (townLabel + ', ' + activeCounty + ' county') : (activeCounty ? (activeCounty + ' county') : '');
        if ($('clearArea')) { $('clearArea').style.display = ''; $('clearArea').onclick = function () { location.href = '/browse.html'; }; }
        if ($('chips')) $('chips').style.display = 'none'; // already scoped to an area
      }
    })();

    function filters() {
      var f = {
        q: $('q').value.trim(), deal: $('deal').value, minBeds: $('beds').value,
        minPrice: $('minPrice').value, maxPrice: $('maxPrice').value, sort: $('sort').value,
        region: activeRegion, county: activeCounty, limit: 60,
      };
      var qs = Object.keys(f).filter(function (k) { return f[k]; })
        .map(function (k) { return k + '=' + encodeURIComponent(f[k]); }).join('&');
      return qs;
    }

    function loadRegions() {
      if (activeCounty || activeRegion) return; // scoped view uses no chips
      api('/api/listings/regions').then(function (rows) {
        var c = $('chips');
        c.innerHTML = '<button class="chip active" data-r="">All areas</button>' +
          (rows || []).map(function (r) {
            return '<button class="chip" data-r="' + r.region.toLowerCase() + '">' +
              r.region + ' <b>' + r.count + '</b></button>';
          }).join('');
        Array.prototype.forEach.call(c.querySelectorAll('.chip'), function (chip) {
          chip.addEventListener('click', function () {
            Array.prototype.forEach.call(c.querySelectorAll('.chip'), function (x) { x.classList.remove('active'); });
            chip.classList.add('active');
            activeRegion = chip.getAttribute('data-r');
            load();
          });
        });
      });
    }

    function card(l) {
      var img = (l.photos && l.photos[0]) || NOPHOTO;
      var deal = l.deal === 'sale' ? 'For sale' : (l.deal === 'land' ? 'Land' : 'For rent');
      var photos = (l.photos && l.photos.length > 1) ? '<span class="photos">' + l.photos.length + ' photos</span>' : '';
      var showcase = l.tier === 'showcase' ? '<span class="tier-badge">Video</span>' : '';
      return '<article class="card" data-id="' + l.id + '">' +
        '<div class="media"><span class="deal">' + deal + '</span>' + showcase + photos +
        '<img loading="lazy" src="' + img + '" alt=""></div>' +
        '<div class="body"><div class="price">' + money(l.price) + '</div>' +
        '<h3>' + escapeHtml(l.title) + '</h3>' +
        '<div class="loc">' + icon('pin') + ' ' + escapeHtml(l.location || l.region || '') + '</div>' +
        '<div class="meta">' + (l.beds ? '<span>' + icon('bed') + ' ' + l.beds + ' bed</span>' : '') +
        (l.baths ? '<span>' + icon('bath') + ' ' + l.baths + ' bath</span>' : '') + '</div></div></article>';
    }

    function render(items) {
      var res = $('results');
      if (!items.length) { res.innerHTML = '<div class="empty"><h3>No listings match your search</h3></div>'; return; }
      // Group by region for a "by area" layout.
      var groups = {};
      items.forEach(function (l) { var r = l.region || 'Other areas'; (groups[r] = groups[r] || []).push(l); });
      var html = Object.keys(groups).sort().map(function (r) {
        return '<h2 class="region-title">' + icon('pin') + ' ' + escapeHtml(r) + '</h2><div class="grid">' +
          groups[r].map(card).join('') + '</div>';
      }).join('');
      res.innerHTML = html;
      Array.prototype.forEach.call(res.querySelectorAll('.card'), function (c) {
        c.addEventListener('click', function () { openModal(c.getAttribute('data-id')); });
      });
    }

    var lastItems = [];
    function load() {
      api('/api/listings?' + filters()).then(function (data) {
        $('count').textContent = data.total || 0;
        lastItems = data.items || [];
        render(lastItems);
        if (mapView) drawMarkers();
      });
    }

    /* ----- Map view (Leaflet + OpenStreetMap, no API key) ----- */
    var GEO = { towns: {}, counties: {} };
    loadLocations().then(function (cs) {
      (cs || []).forEach(function (c) {
        if (c.center) GEO.counties[c.county.toLowerCase()] = c.center;
        var co = c.coords || {};
        Object.keys(co).forEach(function (t) { GEO.towns[t.toLowerCase()] = co[t]; });
      });
    });
    function coordsFor(l, i) {
      if (l.lat != null && l.lng != null) return [Number(l.lat), Number(l.lng)];
      var base = GEO.towns[String(l.region || '').toLowerCase()] || GEO.counties[String(l.county || '').toLowerCase()] || [-1.286, 36.817];
      // deterministic jitter so multiple listings in one town don't overlap
      var j = (i % 8) * 0.0016 - 0.0056, k = (Math.floor(i / 8) % 8) * 0.0016 - 0.0056;
      return [base[0] + j, base[1] + k];
    }
    var map = null, markersLayer = null, mapView = false;
    function ensureMap() {
      if (map || !window.L) return;
      map = L.map('map', { scrollWheelZoom: false }).setView([-1.286, 36.817], 11);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, subdomains: 'abcd', attribution: '© OpenStreetMap, © CARTO',
      }).addTo(map);
      markersLayer = L.layerGroup().addTo(map);
    }
    function drawMarkers() {
      if (!map || !markersLayer) return;
      markersLayer.clearLayers();
      var pts = [];
      lastItems.forEach(function (l, i) {
        var c = coordsFor(l, i);
        pts.push(c);
        var photo = (l.photos && l.photos[0]) || NOPHOTO;
        var html = '<div class="map-pop"><img src="' + photo + '" alt="">' +
          '<div class="mp-price">' + money(l.price) + '</div>' +
          '<div class="mp-title">' + escapeHtml(l.title) + '</div>' +
          '<div class="mp-loc">' + escapeHtml(l.location || l.region || '') + '</div>' +
          '<button class="mp-view" data-id="' + l.id + '">View details</button></div>';
        var m = L.marker(c).addTo(markersLayer).bindPopup(html);
        m.on('popupopen', function () {
          var btn = document.querySelector('.map-pop .mp-view[data-id="' + l.id + '"]');
          if (btn) btn.onclick = function () { openModal(l.id); };
        });
      });
      if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
    }
    if ($('viewToggle')) {
      Array.prototype.forEach.call($('viewToggle').querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          Array.prototype.forEach.call($('viewToggle').querySelectorAll('button'), function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          mapView = b.getAttribute('data-view') === 'map';
          $('results').style.display = mapView ? 'none' : '';
          $('map').style.display = mapView ? 'block' : 'none';
          if (mapView) { ensureMap(); setTimeout(function () { if (map) { map.invalidateSize(); drawMarkers(); } }, 60); }
        });
      });
    }

    function mediaGrid(photos, videos) {
      var v = (videos || []).map(function (u) { return '<video controls preload="metadata" src="' + u + '"></video>'; }).join('');
      var p = (photos || []).map(function (u) { return '<img src="' + u + '" data-full="' + u + '" alt="">'; }).join('');
      return '<div class="room-media">' + v + p + '</div>';
    }

    function openModal(id) {
      api('/api/listings/' + id).then(function (l) {
        if (!l || l.error) return;
        var main = (l.photos && l.photos[0]) || NOPHOTO;
        var deal = l.deal === 'sale' ? 'For sale' : (l.deal === 'land' ? 'Land' : 'For rent');
        var badge = l.tier === 'showcase' ? '<span class="tier-badge">Video showcase</span>' : '';
        var ownerPhone = (l.submitter && l.submitter.phone) ? String(l.submitter.phone).replace(/\D/g, '') : '';
        var waLink = ownerPhone
          ? '<a class="btn" style="margin-bottom:12px" target="_blank" rel="noopener" href="https://wa.me/' + ownerPhone + '?text=' + encodeURIComponent('Hi, I saw your listing "' + l.title + '" on NestKey') + '">Chat on WhatsApp</a>'
          : '';
        var isSale = (l.deal === 'sale' || l.deal === 'land');
        var payBtn = isSale ? '<div class="paybox"><button class="btn" id="pay-house">' + icon('cash') + ' Buy / pay for this property</button></div>' : '';
        var enquire = payBtn +
          '<div class="enquire"><h3>Enquire about this property</h3>' + waLink +
          '<input id="enq-name" placeholder="Your name"><input id="enq-phone" placeholder="Your phone (for a callback)">' +
          '<textarea id="enq-msg" placeholder="Your message"></textarea>' +
          '<div class="status" id="enq-status"></div><button class="btn" id="enq-send">Send enquiry</button></div>';

        // General videos (not tied to a room)
        var generalVideos = (l.videos && l.videos.length)
          ? '<div class="showcase-section"><h3>Video tour</h3>' + mediaGrid([], l.videos) + '</div>' : '';

        // Auto-arranged room-by-room sections (server already ordered them)
        var showcase = '';
        if (l.rooms && l.rooms.length) {
          showcase = l.rooms.map(function (r) {
            if (!(r.photos && r.photos.length) && !(r.videos && r.videos.length) && !r.description) return '';
            return '<div class="showcase-section"><h3>' + escapeHtml(r.label || 'Room') + '</h3>' +
              (r.description ? '<p class="rdesc">' + escapeHtml(r.description) + '</p>' : '') +
              mediaGrid(r.photos, r.videos) + '</div>';
          }).join('');
        }

        // Fallback flat gallery when there are no rooms
        var flat = (!l.rooms || !l.rooms.length)
          ? '<div class="thumbs">' + (l.photos || []).map(function (u) { return '<img src="' + u + '" data-full="' + u + '">'; }).join('') + '</div>'
          : '';

        var hasGeo = (l.lat != null && l.lng != null);
        var locBlock = hasGeo ? ('<div class="showcase-section"><h3>Location</h3>' +
          '<div id="detail-map" class="detail-map"></div>' +
          '<div class="dir-actions">' +
          '<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + l.lat + ',' + l.lng + '">Get directions</a>' +
          '<a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + l.lat + ',' + l.lng + '">Open in Google Maps</a>' +
          '</div></div>') : '';

        $('modalPanel').innerHTML =
          '<img class="hero-img" id="mMain" src="' + main + '" alt="">' +
          '<div class="pad"><div class="price" style="font-size:1.5rem;font-weight:800">' + money(l.price) + '</div>' +
          '<h2>' + escapeHtml(l.title) + badge + '</h2>' +
          '<p class="loc">' + icon('pin') + ' ' + escapeHtml(l.location || l.region || '') + ' · ' + deal + '</p>' +
          '<div class="meta" style="display:flex;gap:16px;color:#5c6b7e;margin:10px 0">' +
          (l.beds ? '<span>' + icon('bed') + ' ' + l.beds + ' bed</span>' : '') +
          (l.baths ? '<span>' + icon('bath') + ' ' + l.baths + ' bath</span>' : '') +
          (l.type ? '<span>' + icon('tag') + ' ' + escapeHtml(l.type) + '</span>' : '') + '</div>' +
          '<p>' + escapeHtml(l.description || '') + '</p>' +
          generalVideos + showcase + flat + locBlock + enquire + '</div>';
        $('modal').classList.add('open');
        if (hasGeo && window.L) {
          setTimeout(function () {
            try {
              var dm = L.map('detail-map', { scrollWheelZoom: false }).setView([l.lat, l.lng], 16);
              L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20, subdomains: 'abcd', attribution: '© OpenStreetMap, © CARTO' }).addTo(dm);
              L.marker([l.lat, l.lng]).addTo(dm);
              dm.invalidateSize();
            } catch (e) {}
          }, 120);
        }
        Array.prototype.forEach.call($('modalPanel').querySelectorAll('img[data-full]'), function (t) {
          t.addEventListener('click', function () { $('mMain').src = t.getAttribute('data-full'); });
        });
        $('enq-send').addEventListener('click', function () {
          var st = $('enq-status');
          if (($('enq-phone').value || '').trim().length < 7) { st.className = 'status show err'; st.textContent = 'Add a phone number so the owner can reach you.'; return; }
          st.className = 'status show info'; st.textContent = 'Sending…';
          api('/api/listings/' + l.id + '/enquire', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: $('enq-name').value, phone: $('enq-phone').value, message: $('enq-msg').value }),
          }).then(function (res) {
            if (!res || res.error) throw new Error('Could not send');
            st.className = 'status show ok'; st.textContent = 'Sent! The owner will get your details.';
          }).catch(function () { st.className = 'status show err'; st.textContent = 'Could not send. Please try again.'; });
        });
        if ($('pay-house')) $('pay-house').addEventListener('click', function () { payFlow(l); });
      });
    }
    $('modalClose').addEventListener('click', function () { $('modal').classList.remove('open'); });
    $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) $('modal').classList.remove('open'); });

    // Tenant pays the landlord directly; we record it + prompt a rating.
    function payFlow(l) {
      api('/api/rent/' + l.id + '/payinfo').then(function (info) {
        var ov = document.createElement('div');
        ov.className = 'sub-modal open';
        if (!info || info.error) {
          ov.innerHTML = '<div class="sub-card"><h3>Payments unavailable</h3><p class="dc-sub">' +
            escapeHtml(info && info.error ? info.error : 'This landlord has not set up payments yet.') +
            '</p><button class="btn block" id="pf-close">Close</button></div>';
          document.body.appendChild(ov);
          ov.querySelector('#pf-close').onclick = function () { ov.remove(); };
          return;
        }
        var pt = info.payTo;
        var instr = pt.method === 'mpesa'
          ? ('Pay by <strong>M-Pesa</strong> to <strong>' + escapeHtml(pt.mpesa || '') + '</strong><br><span class="dc-sub">' + escapeHtml(pt.name) + '</span>')
          : ('Pay to <strong>' + escapeHtml(pt.bankName || '') + '</strong><br>' + escapeHtml(pt.accountName || '') + ' · ' + escapeHtml(pt.accountNumber || ''));
        ov.innerHTML = '<div class="sub-card"><h3>Buy this property</h3>' +
          '<div class="payto-box">' + instr + '</div>' +
          '<label>Amount (KSh)</label><input id="pf-amount" type="number" value="' + (info.amount || '') + '">' +
          '<label>Your name</label><input id="pf-name" placeholder="Your name">' +
          '<label>Your phone</label><input id="pf-phone" placeholder="07xx xxx xxx">' +
          '<label>M-Pesa / reference code (optional)</label><input id="pf-code" placeholder="e.g. QeteXXXX">' +
          '<p class="dc-sub">Pay the seller using the details above, then tap "I\u2019ve paid" so we record it. NestKey charges the seller ' + Math.round((info.commissionRate || 0.08) * 100) + '% commission separately.</p>' +
          '<div class="status" id="pf-status"></div>' +
          '<div class="sub-actions"><button class="btn ghost" id="pf-cancel">Cancel</button><button class="btn block" id="pf-done">I\u2019ve paid</button></div></div>';
        document.body.appendChild(ov);
        ov.querySelector('#pf-cancel').onclick = function () { ov.remove(); };
        ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
        ov.querySelector('#pf-done').onclick = function () {
          var st = ov.querySelector('#pf-status');
          if ((ov.querySelector('#pf-phone').value || '').trim().length < 7) { st.className = 'status show err'; st.textContent = 'Add your phone number.'; return; }
          st.className = 'status show info'; st.textContent = 'Recording…';
          api('/api/rent/' + l.id, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: ov.querySelector('#pf-name').value, phone: ov.querySelector('#pf-phone').value, amount: ov.querySelector('#pf-amount').value, method: ov.querySelector('#pf-code').value }),
          }).then(function (res) {
            if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not record');
            ov.remove();
            showRating('payment');
          }).catch(function (err) { st.className = 'status show err'; st.textContent = err.message; });
        };
      });
    }

    ['deal', 'beds', 'minPrice', 'maxPrice', 'sort'].forEach(function (id) { $(id).addEventListener('change', load); });
    $('q').addEventListener('input', debounce(load, 300));
    loadRegions();
    load();

    // Realtime-ready: refresh listings periodically so newly posted homes appear
    // without a manual reload. Pauses while a listing modal is open.
    setInterval(function () {
      if (!$('modal').classList.contains('open')) { loadRegions(); load(); }
    }, 30000);

    // Real-time: new listings appear the moment an agent publishes them.
    try {
      var es = new EventSource(API + '/api/stream');
      es.addEventListener('listing.published', function () {
        if (!$('modal').classList.contains('open')) { loadRegions(); load(); }
      });
    } catch (e) {}
  }

  /* ---------------- Post + pay ---------------- */
  var SHOWCASE_FEE = 500;
  var ROOM_TYPES = [];
  var tier = 'standard';
  var COMMISSION_RATE = 0.08;
  var LAND_RATE = 1500, LAND_MIN = 300, LAND_MAX = 3000;

  function acresOf(v, unit) {
    v = parseFloat(v) || 0;
    if (unit === 'hectares') return v * 2.47105;
    if (unit === 'sqm') return v * 0.000247105;
    if (unit === 'plots') return v * 0.125; // 50x100 ≈ 1/8 acre
    return v;
  }

  function updateFee() {
    var dealVal = ($('h-deal') || {}).value || 'rent';

    // Land is priced by size, not rooms.
    if (dealVal === 'land') {
      var acres = acresOf(($('p-size-value') || {}).value, ($('p-size-unit') || {}).value || 'acres');
      var total = Math.min(LAND_MAX, Math.max(LAND_MIN, Math.round(acres * LAND_RATE)));
      if ($('feeTotal')) $('feeTotal').textContent = money(total);
      if ($('feeBtn')) $('feeBtn').textContent = money(total);
      if ($('feeBreak')) $('feeBreak').textContent = acres > 0
        ? (acres.toFixed(2) + ' acres × ' + money(LAND_RATE) + '/acre (min ' + money(LAND_MIN) + ', capped ' + money(LAND_MAX) + ')')
        : 'Enter the plot size to calculate the land listing fee';
      return;
    }

    var beds = parseInt(($('beds') || {}).value || '0', 10);
    var rooms = (isNaN(beds) || beds < 1) ? 1 : beds;
    var base = ROOM_RATE * rooms;
    var totalH = base + (tier === 'showcase' ? SHOWCASE_FEE : 0);
    if ($('feeTotal')) $('feeTotal').textContent = money(totalH);
    if ($('feeBreak')) {
      var txt = money(ROOM_RATE) + ' per room × ' + rooms + ' room' + (rooms > 1 ? 's' : '');
      if (tier === 'showcase') txt += '  +  ' + money(SHOWCASE_FEE) + ' showcase (free with Landlord Pro / Agency)';
      $('feeBreak').textContent = txt;
    }
    if ($('feeBtn')) $('feeBtn').textContent = money(totalH);
  }

  if ($('post-form')) {
    if (currentUser() && currentUser().isAdmin) { location.href = '/admin.html'; }
    var form = $('post-form'), btn = $('submitBtn'), statusEl = $('status'), pollTimer = null;
    if ($('beds')) $('beds').addEventListener('input', updateFee);

    fetch(API + '/api/config').then(function (r) { return r.json(); }).then(function (c) {
      if (c) { SHOWCASE_FEE = c.showcaseFee || 500; ROOM_TYPES = c.roomTypes || []; if (c.commissionRate) COMMISSION_RATE = c.commissionRate; if (c.land) { LAND_RATE = c.land.ratePerAcre; LAND_MIN = c.land.min; LAND_MAX = c.land.max; } }
      updateFee(); updateDeal();
    }).catch(function () {});

    // Selecting a listing type reshapes the form + shows sale commission.
    var dealEl = $('h-deal') || form.deal;
    function updateDeal() {
      var d = dealEl ? dealEl.value : 'rent';
      var isLand = d === 'land';
      var isSale = d === 'sale' || d === 'land';
      if ($('price-label')) $('price-label').textContent = d === 'rent' ? 'Monthly rent (KSh)' : (isLand ? 'Price (KSh)' : 'Asking price (KSh)');
      if ($('field-beds')) $('field-beds').style.display = isLand ? 'none' : '';
      if ($('field-baths')) $('field-baths').style.display = isLand ? 'none' : '';
      if ($('field-size')) $('field-size').style.display = isLand ? '' : 'none';
      if ($('field-type')) { var ti = $('field-type').querySelector('input'); if (ti) ti.placeholder = isLand ? 'Plot, Farm, Commercial…' : 'Bedsitter, 1-bed, Maisonette…'; }
      // Land has no rooms — hide the Standard/Video-Showcase toggle and rooms builder.
      var tierWrap = $('tier') ? $('tier').closest('.field') : null;
      if (tierWrap) tierWrap.style.display = isLand ? 'none' : '';
      if (isLand) {
        tier = 'standard';
        if ($('rooms-wrap')) $('rooms-wrap').style.display = 'none';
        if ($('tier')) Array.prototype.forEach.call($('tier').querySelectorAll('button'), function (x) { x.classList.toggle('active', x.getAttribute('data-tier') === 'standard'); });
      }
      updateCommission();
      updateFee();
    }
    function updateCommission() {
      var box = $('commission-preview'); if (!box) return;
      var d = dealEl ? dealEl.value : 'rent';
      var isSale = d === 'sale' || d === 'land';
      if (!isSale) { box.style.display = 'none'; return; }
      box.style.display = '';
      var price = parseFloat((($('h-price') || form.price) || {}).value) || 0;
      var pct = Math.round(COMMISSION_RATE * 100);
      if ($('cp-headline')) $('cp-headline').textContent = 'Commission on sale (' + pct + '%)';
      if ($('cp-detail')) {
        if (price > 0) {
          var comm = Math.round(price * COMMISSION_RATE);
          $('cp-detail').innerHTML = 'When it sells at ' + money(price) + ', NestKey\u2019s ' + pct + '% commission is <strong>' + money(comm) + '</strong>. You receive ' + money(price - comm) + '. Charged only when the property is sold — listing it just needs your plan/listing fee.';
        } else {
          $('cp-detail').textContent = 'Enter an asking price to see the ' + pct + '% commission charged when it sells.';
        }
      }
    }
    if (dealEl) dealEl.addEventListener('change', updateDeal);
    if ($('h-price')) $('h-price').addEventListener('input', updateCommission);
    if ($('p-size-value')) $('p-size-value').addEventListener('input', updateFee);
    if ($('p-size-unit')) $('p-size-unit').addEventListener('change', updateFee);

    if ($('tier')) {
      Array.prototype.forEach.call($('tier').querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          Array.prototype.forEach.call($('tier').querySelectorAll('button'), function (x) { x.classList.remove('active'); });
          b.classList.add('active'); tier = b.getAttribute('data-tier');
          if ($('rooms-wrap')) $('rooms-wrap').style.display = (tier === 'showcase') ? '' : 'none';
          if (tier === 'showcase' && $('rooms-builder') && !$('rooms-builder').children.length) addRoom();
          updateFee();
        });
      });
    }

    function addRoom() {
      var wrap = document.createElement('div');
      wrap.className = 'room-block';
      var opts = ROOM_TYPES.map(function (t) { return '<option value="' + t.key + '">' + t.label + '</option>'; }).join('');
      wrap.innerHTML =
        '<div class="rb-top"><select class="rb-type">' + opts + '</select>' +
        '<button type="button" class="rb-remove" title="Remove">\u00D7</button></div>' +
        '<textarea class="rb-desc" placeholder="Short description of this room / area\u2026"></textarea>' +
        '<div class="rb-files">' +
        '<div><label class="mini">Photos</label><input class="rb-photos" type="file" accept="image/*" multiple></div>' +
        '<div><label class="mini">Video (optional)</label><input class="rb-videos" type="file" accept="video/*" multiple></div>' +
        '</div>';
      wrap.querySelector('.rb-remove').addEventListener('click', function () { wrap.remove(); });
      $('rooms-builder').appendChild(wrap);
    }
    if ($('addRoom')) $('addRoom').addEventListener('click', addRoom);
    if ($('p-county')) wireCountyDatalist($('p-county'), $('region'), $('p-townlist'), $('p-county-list'));

    // Exact-location pin picker + recenter to chosen county.
    var picker = initLocationPicker({ mapId: 'p-map', latId: 'p-lat', lngId: 'p-lng', geoBtnId: 'p-geo', pasteId: 'p-loc-paste', setBtnId: 'p-loc-set', statusId: 'p-loc-status' });
    if (picker && $('p-county')) {
      loadLocations().then(function (cs) {
        $('p-county').addEventListener('change', function () {
          var c = cs.filter(function (x) { return x.county === $('p-county').value; })[0];
          if (c && c.center) picker.recenter(c.center);
        });
      });
    }

    var payVia = 'mpesa';
    function updatePayVia() {
      var card = payVia === 'pesapal';
      if ($('card-hint')) $('card-hint').style.display = card ? '' : 'none';
      if ($('phone-label')) $('phone-label').textContent = card ? 'Phone number (optional)' : 'M-Pesa phone number *';
      if ($('fee-caption')) $('fee-caption').textContent = card ? 'Listing fee — one-off, paid by card / Pesapal' : 'Listing fee — one-off, paid by M-Pesa';
    }
    if ($('payVia')) {
      Array.prototype.forEach.call($('payVia').querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          Array.prototype.forEach.call($('payVia').querySelectorAll('button'), function (x) { x.classList.remove('active'); });
          b.classList.add('active'); payVia = b.getAttribute('data-via');
          updatePayVia();
        });
      });
    }

    function show(kind, html) { statusEl.className = 'status show ' + kind; statusEl.innerHTML = html; }

    function uploadFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      if (!files.length) return Promise.resolve([]);
      var fd = new FormData();
      files.slice(0, 12).forEach(function (f) { fd.append('files', f); });
      return fetch(API + '/api/uploads', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (res) { return (res && res.files) ? res.files : []; });
    }
    function imgs(arr) { return arr.filter(function (f) { return f.type === 'image'; }).map(function (f) { return f.url; }); }
    function vids(arr) { return arr.filter(function (f) { return f.type === 'video'; }).map(function (f) { return f.url; }); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      var title = form.title.value.trim(), phone = form.phone.value.trim();
      if (title.length < 4) { show('err', 'Please add a clear listing title.'); return; }
      if (payVia === 'mpesa' && phone.length < 9) { show('err', 'Enter the M-Pesa phone number to pay from.'); return; }
      if (payVia === 'pesapal' && !form.email.value.trim() && phone.length < 9) { show('err', 'Add your email or phone so we can send a receipt.'); return; }
      btn.disabled = true; show('info', 'Uploading media\u2026 (videos can take a moment)');

      uploadFiles($('photos') ? $('photos').files : []).then(function (cover) {
        var coverUrls = imgs(cover);
        var blocks = (tier === 'showcase' && $('rooms-builder')) ? Array.prototype.slice.call($('rooms-builder').children) : [];
        var chain = blocks.reduce(function (acc, block) {
          return acc.then(function (rooms) {
            var type = block.querySelector('.rb-type').value;
            var desc = block.querySelector('.rb-desc').value;
            return uploadFiles(block.querySelector('.rb-photos').files).then(function (pf) {
              return uploadFiles(block.querySelector('.rb-videos').files).then(function (vf) {
                var ph = imgs(pf), vd = vids(vf);
                if (ph.length || vd.length || desc.trim()) rooms.push({ type: type, description: desc, photos: ph, videos: vd });
                return rooms;
              });
            });
          });
        }, Promise.resolve([]));

        return chain.then(function (rooms) {
          show('info', 'Creating your listing\u2026');
          var isLandDeal = (($('h-deal') || {}).value === 'land');
          var sizeStr = '', areaAcres = null;
          if (isLandDeal && $('p-size-value') && $('p-size-value').value) {
            var su = ($('p-size-unit') || {}).value || 'acres';
            sizeStr = $('p-size-value').value + ' ' + su;
            areaAcres = acresOf($('p-size-value').value, su);
          }
          var body = {
            title: title, deal: form.deal.value, type: form.type.value, price: form.price.value,
            region: form.region.value, location: form.region.value, beds: form.beds.value,
            baths: form.baths.value, description: form.description.value, county: form.county ? form.county.value : '',
            size: sizeStr, areaAcres: areaAcres,
            lat: $('p-lat') ? $('p-lat').value : '', lng: $('p-lng') ? $('p-lng').value : '',
            name: form.name.value, email: form.email.value, phone: phone,
            tier: tier, photos: coverUrls, rooms: rooms,
          };
          return api('/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        });
      }).then(function (res) {
        if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not save');
        var id = res.id;
        function onPaid() {
          show('ok', '<strong>Payment received</strong><br>Your listing is now live. <a href="/">Browse listings \u2192</a>');
          form.reset(); if ($('rooms-builder')) $('rooms-builder').innerHTML = ''; tier = 'standard'; updateFee(); btn.textContent = 'Submitted \u2713';
          showRating('listing');
        }
        if (payVia === 'pesapal') {
          show('info', 'Opening secure card payment\u2026');
          return api('/api/payments/pesapal', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: id }),
          }).then(function (p) {
            if (!p || p.error) throw new Error(p && p.error ? p.error : 'Card payment failed to start');
            statusEl.className = 'status'; statusEl.innerHTML = '';
            openPesapal(p.iframeUrl, p.orderTrackingId, function (st) {
              if (st === 'yes') onPaid();
              else if (st === 'failed') { show('err', 'The payment was not completed. Please try again.'); btn.disabled = false; }
              else { show('info', 'Payment window closed. If you paid, your listing will publish shortly.'); btn.disabled = false; }
            });
          });
        }
        show('info', 'Sending the M-Pesa prompt to your phone\u2026');
        return api('/api/payments/stk', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: id, phone: phone }),
        }).then(function (p) {
          if (!p || p.error) throw new Error(p && p.error ? p.error : 'Payment failed to start');
          show('info', '<strong>Check your phone</strong><br>Enter your M-Pesa PIN to pay ' + money(p.amount) + ' and publish your listing.');
          poll(id);
        });
      }).catch(function (err) {
        show('err', err.message || 'Something went wrong. Please try again.');
        btn.disabled = false;
      });
    });

    function poll(id) {
      var n = 0;
      pollTimer = setInterval(function () {
        n++;
        if (n > 25) { clearInterval(pollTimer); pollTimer = null; show('info', "Still waiting for payment. If you completed it, your listing will publish shortly."); btn.disabled = false; return; }
        api('/api/payments/status/' + id).then(function (s) {
          if (!s) return;
          if (s.status === 'yes') {
            clearInterval(pollTimer); pollTimer = null;
            show('ok', '<strong>Payment received</strong><br>Your listing is now live. <a href="/">Browse listings \u2192</a>');
            form.reset(); if ($('rooms-builder')) $('rooms-builder').innerHTML = ''; tier = 'standard'; updateFee(); btn.textContent = 'Submitted \u2713';
          } else if (s.status === 'failed') {
            clearInterval(pollTimer); pollTimer = null;
            show('err', 'The payment was not completed. No fee was charged. Please try again.');
            btn.disabled = false;
          }
        });
      }, 4000);
    }
  }

  /* ---------------- Services / subscriptions ---------------- */
  if ($('services')) {
    var plans = [];
    var billing = 'monthly';
    var current = null;
    var subTimer = null;

    fetch(API + '/api/subscriptions/plans').then(function (r) { return r.json(); })
      .then(function (p) { plans = p || []; renderPlans(); });

    function renderPlans() {
      $('plans').innerHTML = plans.map(function (pl) {
        var price = billing === 'annual' ? pl.annual : pl.monthly;
        var per = billing === 'annual' ? '/year' : '/month';
        return '<div class="plan' + (pl.popular ? ' popular' : '') + '">' +
          (pl.popular ? '<div class="ribbon">Most popular</div>' : '') +
          '<div class="audience">' + escapeHtml(pl.audience) + '</div>' +
          '<h3>' + escapeHtml(pl.name) + '</h3>' +
          '<div class="price">' + money(price) + '<small>' + per + '</small></div>' +
          '<ul>' + pl.features.map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('') + '</ul>' +
          '<button class="btn" data-plan="' + pl.id + '">Choose ' + escapeHtml(pl.name) + '</button></div>';
      }).join('');
      Array.prototype.forEach.call($('plans').querySelectorAll('button[data-plan]'), function (btn) {
        btn.addEventListener('click', function () { openSub(btn.getAttribute('data-plan')); });
      });
    }

    Array.prototype.forEach.call($('billing').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call($('billing').querySelectorAll('button'), function (x) { x.classList.remove('active'); });
        b.classList.add('active'); billing = b.getAttribute('data-billing'); renderPlans();
      });
    });

    function openSub(planId) {
      current = plans.filter(function (p) { return p.id === planId; })[0];
      if (!current) return;
      var amount = billing === 'annual' ? current.annual : current.monthly;
      $('subPlan').textContent = 'Subscribe — ' + current.name;
      $('subLine').textContent = current.audience + ' · billed ' + billing;
      $('subAmount').textContent = money(amount) + (billing === 'annual' ? ' / year' : ' / month');
      $('subStatus').className = 'status'; $('subStatus').innerHTML = '';
      $('subPay').disabled = false; $('subPay').textContent = 'Pay with M-Pesa';
      $('subModal').classList.add('open');
    }
    function closeSub() { $('subModal').classList.remove('open'); if (subTimer) { clearInterval(subTimer); subTimer = null; } }
    $('subCancel').addEventListener('click', closeSub);
    $('subModal').addEventListener('click', function (e) { if (e.target === $('subModal')) closeSub(); });
    function subShow(kind, html) { var s = $('subStatus'); s.className = 'status show ' + kind; s.innerHTML = html; }

    var subVia = 'mpesa';
    if ($('subPayVia')) {
      Array.prototype.forEach.call($('subPayVia').querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          Array.prototype.forEach.call($('subPayVia').querySelectorAll('button'), function (x) { x.classList.remove('active'); });
          b.classList.add('active'); subVia = b.getAttribute('data-via');
        });
      });
    }

    function subActivated(periodEnd) {
      var end = periodEnd ? new Date(periodEnd).toLocaleDateString() : '';
      subShow('ok', '<strong>You\u2019re subscribed</strong><br>' + current.name + ' is active' + (end ? (' until ' + end) : '') + '.');
      $('subPay').textContent = 'Subscribed \u2713';
      showRating('subscription');
    }

    $('subPay').addEventListener('click', function () {
      var phone = $('subPhone').value.trim();
      if (phone.length < 9 && subVia === 'mpesa') { subShow('err', 'Enter the M-Pesa number to pay from.'); return; }
      var pay = $('subPay'); pay.disabled = true; subShow('info', 'Starting payment\u2026');

      if (subVia === 'pesapal') {
        fetch(API + '/api/subscriptions/pesapal', {
          method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ planId: current.id, billing: billing, phone: phone, name: $('subName').value, email: $('subEmail').value }),
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not start');
          subShow('info', 'Opening secure card payment\u2026');
          openPesapal(res.iframeUrl, res.orderTrackingId, function (st) {
            if (st === 'yes') { subActivated(null); }
            else { subShow('err', 'Payment was not completed. Please try again.'); pay.disabled = false; }
          });
        }).catch(function (err) { subShow('err', err.message || 'Something went wrong.'); pay.disabled = false; });
        return;
      }

      // M-Pesa STK
      fetch(API + '/api/subscriptions/subscribe', {
        method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ planId: current.id, billing: billing, phone: phone, name: $('subName').value, email: $('subEmail').value }),
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not start');
        subShow('info', '<strong>Check your phone</strong><br>Enter your M-Pesa PIN to pay ' + money(res.amount) + '.');
        var n = 0;
        subTimer = setInterval(function () {
          n++;
          if (n > 25) { clearInterval(subTimer); subTimer = null; subShow('info', 'Still waiting. If you paid, your plan will activate shortly.'); pay.disabled = false; return; }
          fetch(API + '/api/subscriptions/status/' + res.id).then(function (r) { return r.json(); }).then(function (s) {
            if (!s) return;
            if (s.status === 'yes') { clearInterval(subTimer); subTimer = null; subActivated(s.periodEnd); }
            else if (s.status === 'failed') { clearInterval(subTimer); subTimer = null; subShow('err', 'Payment was not completed. Please try again.'); pay.disabled = false; }
          });
        }, 4000);
      }).catch(function (err) { subShow('err', err.message || 'Something went wrong.'); pay.disabled = false; });
    });

    $('mgBtn').addEventListener('click', function () {
      var phone = $('mgPhone').value.trim();
      if (phone.length < 9) { $('mgResult').innerHTML = '<div class="status show err">Enter a valid number.</div>'; return; }
      $('mgResult').textContent = 'Checking…';
      fetch(API + '/api/subscriptions/me?phone=' + encodeURIComponent(phone)).then(function (r) { return r.json(); }).then(function (s) {
        if (s && s.active) {
          var end = s.periodEnd ? new Date(s.periodEnd).toLocaleDateString() : '';
          $('mgResult').innerHTML = '<div class="status show ok"><strong>Active: ' + escapeHtml(s.plan) + '</strong> (' + escapeHtml(s.billing) + ')' + (end ? (' · renews/expires ' + end) : '') + '</div>';
        } else {
          $('mgResult').innerHTML = '<div class="status show info">No active subscription found for that number.</div>';
        }
      }).catch(function () { $('mgResult').textContent = 'Could not check right now.'; });
    });
  }

  /* ---------------- Front page: county → town finder ---------------- */
  if ($('home')) {
    // Social proof from real ratings.
    fetch(API + '/api/ratings/summary').then(function (r) { return r.json(); }).then(function (s) {
      if (s && s.count > 0 && $('rating-proof')) {
        var full = Math.round(s.average);
        var stars = '';
        for (var i = 0; i < 5; i++) stars += (i < full ? '\u2605' : '\u2606');
        $('rating-proof').innerHTML = '<span class="rp-stars">' + stars + '</span> ' +
          '<strong>' + s.average.toFixed(1) + '</strong> from ' + s.count + ' rating' + (s.count === 1 ? '' : 's');
      }
    }).catch(function () {});

    var countyEl = $('f-county'), townEl = $('f-town');
    loadLocations().then(function (cs) {
      if ($('f-county-list')) $('f-county-list').innerHTML = cs.map(function (c) { return '<option value="' + c.county + '">'; }).join('');
      function fillTowns() {
        var c = cs.filter(function (x) { return x.county.toLowerCase() === String(countyEl.value || '').toLowerCase(); })[0];
        var towns = c ? c.towns : [];
        if ($('f-town-list')) $('f-town-list').innerHTML = towns.map(function (t) { return '<option value="' + t + '">'; }).join('');
      }
      countyEl.addEventListener('input', fillTowns);

      // County cards (quick links)
      $('county-grid').innerHTML = cs.map(function (c) {
        return '<a class="county-card" href="/browse.html?county=' + encodeURIComponent(c.county) + '">' +
          '<span class="cc-name">' + c.county + '</span><span class="cc-sub">' + c.towns.length + ' areas</span></a>';
      }).join('');
    });

    $('f-go').addEventListener('click', function () {
      var params = [];
      if (countyEl.value.trim()) params.push('county=' + encodeURIComponent(countyEl.value.trim()));
      if (townEl.value.trim()) params.push('town=' + encodeURIComponent(townEl.value.trim()));
      if ($('f-deal').value) params.push('deal=' + encodeURIComponent($('f-deal').value));
      location.href = '/browse.html' + (params.length ? '?' + params.join('&') : '');
    });
  }

  /* ---------------- Contact form ---------------- */
  if ($('contact-form')) {
    $('contact-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, s = $('contact-status');
      s.className = 'status show info'; s.textContent = 'Sending…';
      fetch(API + '/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: f.name.value, contact: f.contact.value, message: f.message.value }),
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not send');
        s.className = 'status show ok'; s.textContent = 'Thanks! Your message has been sent — we\u2019ll get back to you.';
        f.reset();
      }).catch(function (err) { s.className = 'status show err'; s.textContent = err.message; });
    });
  }

  /* ---------------- Account: register + login ---------------- */
  if ($('account')) {
    var tabs = $('account').querySelectorAll('.auth-tabs button');
    Array.prototype.forEach.call(tabs, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var t = b.getAttribute('data-tab');
        $('login-form').style.display = t === 'login' ? '' : 'none';
        $('register-form').style.display = t === 'register' ? '' : 'none';
      });
    });

    function authShow(id, kind, msg) { var s = $(id); s.className = 'status show ' + kind; s.textContent = msg; }

    $('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email.value, password: f.password.value }) })
        .then(function (res) {
          if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not sign in');
          setAuth(res.token, res.user); location.href = (res.user && res.user.isAdmin) ? '/admin.html' : '/dashboard.html';
        }).catch(function (err) { authShow('login-status', 'err', err.message); });
    });

    $('register-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      api('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: f.name.value, role: f.role.value, company: f.company.value, phone: f.phone.value, email: f.email.value, password: f.password.value }),
      }).then(function (res) {
        if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not create account');
        setAuth(res.token, res.user); location.href = (res.user && res.user.isAdmin) ? '/admin.html' : '/dashboard.html';
      }).catch(function (err) { authShow('register-status', 'err', err.message); });
    });
  }

  /* ---------------- Agent dashboard ---------------- */
  if ($('dashboard')) {
    if (!getToken()) { location.href = '/account.html'; }
    var user = currentUser();
    if (user && $('hello')) $('hello').textContent = 'Welcome, ' + (user.name || 'there');
    if ($('signout')) $('signout').addEventListener('click', function (e) { e.preventDefault(); clearAuth(); location.href = '/'; });
    if ($('ag-county')) wireCountyDatalist($('ag-county'), $('ag-region'), $('ag-townlist'), $('ag-county-list'));
    var agPicker = initLocationPicker({ mapId: 'ag-map', latId: 'ag-lat', lngId: 'ag-lng', geoBtnId: 'ag-geo', pasteId: 'ag-loc-paste', setBtnId: 'ag-loc-set', statusId: 'ag-loc-status' });
    if (agPicker && $('ag-county')) {
      loadLocations().then(function (cs) {
        $('ag-county').addEventListener('change', function () {
          var c = cs.filter(function (x) { return x.county === $('ag-county').value; })[0];
          if (c && c.center) agPicker.recenter(c.center);
        });
      });
    }

    // Load commission/land rates for previews.
    fetch(API + '/api/config').then(function (r) { return r.json(); }).then(function (c) {
      if (c && c.commissionRate) COMMISSION_RATE = c.commissionRate;
      agUpdateDeal();
    }).catch(function () {});

    // Selecting a listing type reshapes the dashboard form (land hides house fields).
    var agDeal = $('ag-deal');
    function agUpdateDeal() {
      var d = agDeal ? agDeal.value : 'rent';
      var isLand = d === 'land';
      var isSale = d === 'sale' || d === 'land';
      if ($('ag-price-label')) $('ag-price-label').textContent = d === 'rent' ? 'Monthly rent (KSh)' : (isLand ? 'Price (KSh)' : 'Asking price (KSh)');
      if ($('ag-field-beds')) $('ag-field-beds').style.display = isLand ? 'none' : '';
      if ($('ag-field-baths')) $('ag-field-baths').style.display = isLand ? 'none' : '';
      if ($('ag-field-size')) $('ag-field-size').style.display = isLand ? '' : 'none';
      if ($('ag-field-videos')) $('ag-field-videos').style.display = isLand ? 'none' : '';
      if ($('ag-field-type')) { var ti = $('ag-field-type').querySelector('input'); if (ti) ti.placeholder = isLand ? 'Plot, Farm, Commercial…' : 'Apartment, Maisonette…'; }
      var box = $('ag-commission');
      if (box) {
        if (!isSale) { box.style.display = 'none'; }
        else {
          box.style.display = '';
          var price = parseFloat(($('ag-price') || {}).value) || 0;
          var pct = Math.round(COMMISSION_RATE * 100);
          if ($('ag-cp-headline')) $('ag-cp-headline').textContent = 'Commission on sale (' + pct + '%)';
          if ($('ag-cp-detail')) $('ag-cp-detail').innerHTML = price > 0
            ? (' — when it sells at ' + money(price) + ', our ' + pct + '% is <strong>' + money(Math.round(price * COMMISSION_RATE)) + '</strong>. You receive ' + money(price - Math.round(price * COMMISSION_RATE)) + '.')
            : (' — NestKey charges ' + pct + '% when the property sells. Enter a price to preview it.');
        }
      }
    }
    if (agDeal) agDeal.addEventListener('change', agUpdateDeal);
    if ($('ag-price')) $('ag-price').addEventListener('input', agUpdateDeal);

    function guard(res) { if (res && res.status === 401) { clearAuth(); location.href = '/account.html'; } return res; }

    function loadSummary() {
      fetch(API + '/api/agent/summary', { headers: authHeaders() }).then(guard).then(function (r) { return r.json(); }).then(function (s) {
        if (!s || s.error) return;
        var q = s.quota || {};
        var pct = (q.max && q.max > 0) ? Math.min(100, Math.round((q.used / q.max) * 100)) : (q.max == null ? 0 : 0);
        var quotaLabel = q.max == null ? (q.used + ' published · unlimited') : (q.used + ' / ' + q.max + ' published');
        var planName = s.subscription ? s.subscription.plan : 'No plan yet';
        $('summary').innerHTML =
          '<div class="dash-card"><div class="dc-num">' + (s.counts ? s.counts.published : 0) + '</div><div class="dc-lbl">Published</div></div>' +
          '<div class="dash-card"><div class="dc-num">' + (s.counts ? s.counts.draft : 0) + '</div><div class="dc-lbl">Drafts</div></div>' +
          '<div class="dash-card"><div class="dc-num">' + (s.leads || 0) + '</div><div class="dc-lbl">Enquiries</div></div>' +
          '<div class="dash-card wide"><div class="dc-lbl">Plan — ' + escapeHtml(planName) + '</div>' +
          '<div class="quota-bar"><span style="width:' + pct + '%"></span></div>' +
          '<div class="dc-sub">' + quotaLabel + ' · <a href="/services.html">Manage plan →</a></div></div>';
      });
    }

    function statusPill(st) {
      var c = st === 'published' ? 'ok' : (st === 'draft' ? 'muted' : 'warn');
      return '<span class="pill ' + c + '">' + st + '</span>';
    }

    function loadListings() {
      fetch(API + '/api/agent/listings', { headers: authHeaders() }).then(guard).then(function (r) { return r.json(); }).then(function (d) {
        var items = (d && d.items) || [];
        if (!items.length) { $('my-listings').innerHTML = '<p class="dc-sub">No properties yet — add your first one above.</p>'; return; }
        $('my-listings').innerHTML = '<table class="dash-table"><thead><tr><th>Property</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead><tbody>' +
          items.map(function (l) {
            var act = (l.status === 'published')
              ? '<button class="mini-btn" data-act="unpublish" data-id="' + l.id + '">Unpublish</button>'
              : '<button class="mini-btn primary" data-act="publish" data-id="' + l.id + '">Publish</button>';
            act += '<button class="mini-btn danger" data-act="delete" data-id="' + l.id + '">Delete</button>';
            return '<tr><td><strong>' + escapeHtml(l.title) + '</strong><br><span class="dc-sub">' + money(l.price) + ' · ' + escapeHtml(l.region || '') + '</span></td>' +
              '<td>' + statusPill(l.status) + '</td><td>' + (l.views || 0) + '</td><td class="acts">' + act + '</td></tr>';
          }).join('') + '</tbody></table>';
        Array.prototype.forEach.call($('my-listings').querySelectorAll('button[data-act]'), function (btn) {
          btn.addEventListener('click', function () { doAct(btn.getAttribute('data-act'), btn.getAttribute('data-id')); });
        });
      });
    }

    function doAct(act, id) {
      if (act === 'delete') {
        if (!confirm('Delete this property?')) return;
        fetch(API + '/api/agent/listings/' + id, { method: 'DELETE', headers: authHeaders() }).then(guard).then(function () { loadListings(); loadSummary(); });
        return;
      }
      fetch(API + '/api/agent/listings/' + id + '/' + act, { method: 'POST', headers: authHeaders() }).then(guard).then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.error) {
          if (res.needPlan || res.quota) { toast(res.error); location.href = '/services.html'; }
          else toast(res.error);
          return;
        }
        loadListings(); loadSummary();
      });
    }

    function loadLeads() {
      fetch(API + '/api/agent/leads', { headers: authHeaders() }).then(guard).then(function (r) { return r.json(); }).then(function (d) {
        var items = (d && d.items) || [];
        if (!items.length) { $('leads').innerHTML = '<p class="dc-sub">No enquiries yet.</p>'; return; }
        $('leads').innerHTML = items.map(function (l) {
          var wa = l.phone ? '<a href="https://wa.me/' + String(l.phone).replace(/\D/g, '') + '" target="_blank">WhatsApp →</a>' : '';
          return '<div class="lead"><strong>' + escapeHtml(l.name || 'Someone') + '</strong> · ' + escapeHtml(l.phone || '') + ' ' + wa +
            '<div class="dc-sub">' + escapeHtml(l.message || '') + '</div></div>';
        }).join('');
      });
    }

    // Add-listing form
    function upFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      if (!files.length) return Promise.resolve([]);
      var fd = new FormData(); files.slice(0, 12).forEach(function (f) { fd.append('files', f); });
      return fetch(API + '/api/uploads', { method: 'POST', body: fd }).then(function (r) { return r.json(); }).then(function (res) { return (res && res.files) ? res.files : []; });
    }
    $('agent-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, s = $('agent-status');
      if (f.title.value.trim().length < 4) { s.className = 'status show err'; s.textContent = 'Add a clear title.'; return; }
      s.className = 'status show info'; s.textContent = 'Uploading & saving…';
      upFiles($('ag-photos').files).then(function (pf) {
        var isLandDeal = f.deal.value === 'land';
        var vidsPromise = isLandDeal ? Promise.resolve([]) : upFiles($('ag-videos').files);
        return vidsPromise.then(function (vf) {
          var photos = pf.filter(function (x) { return x.type === 'image'; }).map(function (x) { return x.url; });
          var videos = vf.filter(function (x) { return x.type === 'video'; }).map(function (x) { return x.url; });
          var tier = videos.length ? 'showcase' : 'standard';
          var sizeStr = '', areaAcres = null;
          if (isLandDeal && $('ag-size-value') && $('ag-size-value').value) {
            var su = ($('ag-size-unit') || {}).value || 'acres';
            sizeStr = $('ag-size-value').value + ' ' + su;
            areaAcres = acresOf($('ag-size-value').value, su);
          }
          return fetch(API + '/api/agent/listings', {
            method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              title: f.title.value, deal: f.deal.value, type: f.type.value, price: f.price.value,
              region: f.region.value, county: f.county ? f.county.value : '', beds: f.beds.value, baths: f.baths.value,
              size: sizeStr, areaAcres: areaAcres,
              lat: $('ag-lat') ? $('ag-lat').value : '', lng: $('ag-lng') ? $('ag-lng').value : '',
              description: f.description.value, photos: photos, videos: videos, tier: tier, phone: (user && user.phone) || '',
            }),
          }).then(guard).then(function (r) { return r.json(); });
        });
      }).then(function (res) {
        if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not save');
        s.className = 'status show ok'; s.textContent = 'Saved as draft — hit Publish when ready.';
        f.reset(); agUpdateDeal(); loadListings(); loadSummary();
      }).catch(function (err) { s.className = 'status show err'; s.textContent = err.message; });
    });

    // Real-time: private lead events for this agent
    try {
      var es = new EventSource(API + '/api/stream?token=' + encodeURIComponent(getToken() || ''));
      es.addEventListener('lead.created', function (ev) {
        var d = {}; try { d = JSON.parse(ev.data); } catch (e) {}
        toast('New enquiry' + (d.title ? ' on ' + d.title : '') + '!');
        loadLeads(); loadSummary();
      });
      es.addEventListener('payment.recorded', function (ev) {
        var d = {}; try { d = JSON.parse(ev.data); } catch (e) {}
        toast('Payment recorded' + (d.title ? ' for ' + d.title : '') + '!');
        loadTransactions();
      });
    } catch (e) {}

    // ----- Payment details -----
    var methodEl = $('pm-method');
    function togglePm() {
      $('pm-mpesa').style.display = methodEl.value === 'mpesa' ? '' : 'none';
      $('pm-bank').style.display = methodEl.value === 'bank' ? '' : 'none';
    }
    methodEl.addEventListener('change', togglePm);
    fetch(API + '/api/agent/profile', { headers: authHeaders() }).then(guard).then(function (r) { return r.json(); }).then(function (p) {
      if (!p || p.error) return;
      var f = $('payout-form');
      ['payoutMethod', 'payoutMpesa', 'bankName', 'bankAccountName', 'bankAccountNumber', 'businessName', 'idNumber', 'kraPin'].forEach(function (k) {
        if (f[k] != null && p[k] != null) f[k].value = p[k];
      });
      togglePm();
    });
    $('payout-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, s = $('payout-status');
      var body = {};
      ['payoutMethod', 'payoutMpesa', 'bankName', 'bankAccountName', 'bankAccountNumber', 'businessName', 'idNumber', 'kraPin'].forEach(function (k) { body[k] = f[k] ? f[k].value : ''; });
      if (!body.payoutMethod) { s.className = 'status show err'; s.textContent = 'Choose how you want to receive payments.'; return; }
      fetch(API + '/api/agent/profile', { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
        .then(guard).then(function (r) { return r.json(); }).then(function (res) {
          if (res && res.error) { s.className = 'status show err'; s.textContent = res.error; return; }
          s.className = 'status show ok'; s.textContent = 'Saved. Tenants can now pay you through the site.';
        });
    });

    // ----- Rent payments + commission -----
    function loadTransactions() {
      fetch(API + '/api/agent/transactions', { headers: authHeaders() }).then(guard).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || d.error) return;
        var sm = d.summary || {};
        var owed = sm.owed || 0;
        $('commission-box').innerHTML =
          '<div class="cbox-grid">' +
          '<div><div class="dc-lbl">Sales recorded</div><div class="dc-num sm">' + money(sm.collected || 0) + '</div></div>' +
          '<div><div class="dc-lbl">Commission owed (8%)</div><div class="dc-num sm">' + money(owed) + '</div></div>' +
          '</div>' +
          (owed > 0 ? '<button class="btn" id="pay-commission">Pay commission (' + money(owed) + ')</button>' : '<div class="dc-sub">No commission due. Rentals are commission-free — you only pay your monthly plan.</div>');
        if (owed > 0) $('pay-commission').addEventListener('click', payCommission);

        var items = d.items || [];
        $('transactions').innerHTML = !items.length ? '<p class="dc-sub">No sale payments recorded yet. (Rentals don\u2019t incur commission.)</p>' :
          '<table class="dash-table"><thead><tr><th>Property</th><th>Buyer</th><th>Amount</th><th>Our 8%</th><th>Invoice</th></tr></thead><tbody>' +
          items.map(function (t) {
            return '<tr><td>' + escapeHtml(t.listingTitle || '') + '</td><td>' + escapeHtml((t.tenant && t.tenant.name) || '') + '<br><span class="dc-sub">' + escapeHtml((t.tenant && t.tenant.phone) || '') + '</span></td>' +
              '<td>' + money(t.gross) + '</td><td>' + money(t.commission) + '</td><td>' + statusPill(t.invoiceStatus === 'paid' ? 'paid' : 'due') + '</td></tr>';
          }).join('') + '</tbody></table>';
      });
    }

    function payCommission() {
      var phone = (user && user.phone) || prompt('M-Pesa number to pay from:');
      if (!phone) return;
      fetch(API + '/api/agent/commission/pay', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ provider: 'mpesa', phone: phone }) })
        .then(guard).then(function (r) { return r.json(); }).then(function (res) {
          if (!res || res.error) { toast(res && res.error ? res.error : 'Could not start'); return; }
          toast('Check your phone to approve the commission payment.');
          var n = 0, t = setInterval(function () {
            n++; if (n > 20) { clearInterval(t); return; }
            loadTransactions();
          }, 5000);
        });
    }

    loadSummary(); loadListings(); loadLeads(); loadTransactions();
  }

  /* ---------------- Admin Command Center ---------------- */
  if ($('admin')) {
    if (!getToken()) { location.href = '/account.html'; }
    if ($('signout')) $('signout').addEventListener('click', function (e) { e.preventDefault(); clearAuth(); location.href = '/'; });

    var iconFor = { listing: icon('home'), user: icon('user'), subscription: icon('card'), payment: icon('cash'), lead: icon('mail'), rating: icon('star') };

    function timeAgo(d) {
      var s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      if (s < 86400) return Math.floor(s / 3600) + 'h ago';
      return Math.floor(s / 86400) + 'd ago';
    }
    function feedRow(it) {
      return '<div class="feed-row"><span class="feed-ic">' + (iconFor[it.kind] || '•') + '</span>' +
        '<span class="feed-text">' + escapeHtml(it.text) + '</span>' +
        '<span class="feed-time">' + timeAgo(it.at) + '</span></div>';
    }

    function bars(el, rows) {
      if (!rows || !rows.length) { el.innerHTML = '<p class="dc-sub">No data yet.</p>'; return; }
      var max = Math.max.apply(null, rows.map(function (r) { return r.count; }));
      el.innerHTML = rows.map(function (r) {
        var pct = max ? Math.round((r.count / max) * 100) : 0;
        return '<div class="bar-row"><span class="bar-label">' + escapeHtml(r.label || '—') + '</span>' +
          '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="bar-val">' + r.count + '</span></div>';
      }).join('');
    }

    function loadOverview() {
      fetch(API + '/api/admin/overview', { headers: authHeaders() }).then(function (r) {
        if (r.status === 403) { document.getElementById('admin').innerHTML = '<div class="status show err">This area is for administrators only.</div>'; throw new Error('forbidden'); }
        if (r.status === 401) { clearAuth(); location.href = '/account.html'; throw new Error('auth'); }
        return r.json();
      }).then(function (d) {
        var s = d.stats || {}, li = s.listings || {};
        var kpis = [
          { n: s.users || 0, l: 'Users' },
          { n: li.published || 0, l: 'Live listings' },
          { n: li.draft || 0, l: 'Drafts' },
          { n: s.subsActive || 0, l: 'Active plans' },
          { n: money(s.subRevenue || 0), l: 'Plan revenue' },
          { n: money(s.salesValue || 0), l: 'Sales value' },
          { n: money(s.commissionCollected || 0), l: 'Commission earned' },
          { n: money(s.commissionOwed || 0), l: 'Commission owed' },
          { n: s.leads || 0, l: 'Enquiries' },
          { n: (d.ratings && d.ratings.count ? d.ratings.average.toFixed(1) : '—'), l: 'Avg rating' },
        ];
        $('kpis').innerHTML = kpis.map(function (k) {
          return '<div class="kpi"><div class="kpi-num">' + k.n + '</div><div class="kpi-lbl">' + k.l + '</div></div>';
        }).join('');
        bars($('by-county'), s.byCounty);
        bars($('by-deal'), (s.byDeal || []).map(function (x) { return { label: (x.label === 'rent' ? 'For rent' : x.label === 'sale' ? 'For sale' : 'Land'), count: x.count }; }));
      }).catch(function () {});
    }

    function loadFeed() {
      fetch(API + '/api/admin/activity', { headers: authHeaders() }).then(function (r) { return r.json(); }).then(function (d) {
        var items = (d && d.items) || [];
        $('feed').innerHTML = items.length ? items.map(feedRow).join('') : '<p class="dc-sub">No activity yet.</p>';
      }).catch(function () {});
    }

    function loadAdminListings() {
      fetch(API + '/api/admin/listings', { headers: authHeaders() }).then(function (r) { return r.json(); }).then(function (d) {
        var items = (d && d.items) || [];
        if (!items.length) { $('admin-listings').innerHTML = '<p class="dc-sub">No listings yet.</p>'; return; }
        $('admin-listings').innerHTML = '<table class="dash-table"><thead><tr><th>Property</th><th>Type</th><th>Area</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead><tbody>' +
          items.map(function (l) {
            var act = (l.status === 'published')
              ? '<button class="mini-btn" data-a="unpublish" data-id="' + l.id + '">Unpublish</button>'
              : '<button class="mini-btn primary" data-a="publish" data-id="' + l.id + '">Publish</button>';
            act += '<button class="mini-btn danger" data-a="delete" data-id="' + l.id + '">Delete</button>';
            return '<tr><td><strong>' + escapeHtml(l.title) + '</strong><br><span class="dc-sub">' + money(l.price) + '</span></td>' +
              '<td>' + escapeHtml(l.deal) + '</td><td>' + escapeHtml((l.region || '') + (l.county ? ', ' + l.county : '')) + '</td>' +
              '<td><span class="pill ' + (l.status === 'published' ? 'ok' : (l.status === 'draft' ? 'muted' : 'warn')) + '">' + l.status + '</span></td>' +
              '<td>' + (l.views || 0) + '</td><td class="acts">' + act + '</td></tr>';
          }).join('') + '</tbody></table>';
        Array.prototype.forEach.call($('admin-listings').querySelectorAll('button[data-a]'), function (b) {
          b.addEventListener('click', function () {
            var a = b.getAttribute('data-a'), id = b.getAttribute('data-id');
            if (a === 'delete' && !confirm('Delete this listing permanently?')) return;
            var opts = { method: a === 'delete' ? 'DELETE' : 'POST', headers: authHeaders() };
            var url = a === 'delete' ? '/api/admin/listings/' + id : '/api/admin/listings/' + id + '/' + a;
            fetch(API + url, opts).then(function () { loadAdminListings(); loadOverview(); });
          });
        });
      }).catch(function () {});
    }

    loadOverview(); loadFeed(); loadAdminListings();
    setInterval(function () { loadOverview(); loadAdminListings(); }, 60000);

    // Live: prepend new activity as it happens.
    try {
      var es = new EventSource(API + '/api/stream?token=' + encodeURIComponent(getToken() || ''));
      es.addEventListener('activity', function (ev) {
        var it = {}; try { it = JSON.parse(ev.data); } catch (e) {}
        if (!it.text) return;
        var feed = $('feed');
        if (feed.querySelector('.dc-sub')) feed.innerHTML = '';
        var div = document.createElement('div');
        div.innerHTML = feedRow(it);
        var node = div.firstChild; node.classList.add('feed-new');
        feed.insertBefore(node, feed.firstChild);
        var dot = $('live-dot'); if (dot) { dot.classList.add('pulse'); setTimeout(function () { dot.classList.remove('pulse'); }, 1000); }
        loadOverview();
      });
    } catch (e) {}
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
