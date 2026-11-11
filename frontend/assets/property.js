/* NestKey property page. */
(function () {
  var API = window.NESTKEY_API ? String(window.NESTKEY_API).replace(/\/$/, '') : '';
  var m = location.pathname.match(/^\/property\/(\d+|[a-f0-9]{24})/i);
  var id = window.NESTKEY_LISTING_ID || (m && m[1]) || new URLSearchParams(location.search).get('id');
  var panel = document.getElementById('property-panel');
  if (!panel) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); }
  function $(i) { return document.getElementById(i); }
  function waNumber(p) { var d = String(p || '').replace(/\D/g, ''); if (/^0\d{9}$/.test(d)) d = '254' + d.slice(1); else if (/^[71]\d{8}$/.test(d)) d = '254' + d; return d; }
  function telNumber(p) { return String(p || '').replace(/[^\d+]/g, ''); }
  function token() { try { return localStorage.getItem('hh_token'); } catch (e) { return null; } }

  var SVG = function (d, extra) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + d + '</svg>'; };
  var IC = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/></svg>',
    heart: SVG('<path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 5a5 5 0 0 1 9.5 7c-2.5 4.5-9.5 9-9.5 9z"/>'),
    share: SVG('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
    grid: SVG('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.13c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.83 0-1.34.7-2 .96-2.28.25-.27.55-.34.73-.34l.53.01c.17.01.4-.06.62.48.24.56.8 1.94.86 2.08.07.14.12.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.28.14.44.11.6-.07.16-.18.69-.8.88-1.08.18-.27.36-.23.61-.14.25.09 1.6.75 1.87.89.28.14.46.2.53.32.06.11.06.66-.18 1.34z"/></svg>',
    cash: SVG('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
    bed: SVG('<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 14h18M7 10V7h4v3"/>'),
    bath: SVG('<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V5a2 2 0 0 1 4 0"/>'),
    home: SVG('<path d="M3 11.5 12 4l9 7.5M5 10v10h14V10"/>'),
  };

  // ---- Saved homes (same storage as the browse page) ----
  var favs = [];
  function localFavs(v) { try { if (v) localStorage.setItem('nk_favs', JSON.stringify(v)); return JSON.parse(localStorage.getItem('nk_favs') || '[]').map(String); } catch (e) { return []; } }
  function loadFavs() {
    if (token()) return fetch(API + '/api/favourites', { headers: { Authorization: 'Bearer ' + token() } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { favs = (d && d.ids || []).map(String); }).catch(function () {});
    favs = localFavs(); return Promise.resolve();
  }
  function toggleFav(lid) {
    lid = String(lid); var on = favs.indexOf(lid) < 0;
    favs = on ? favs.concat(lid) : favs.filter(function (x) { return x !== lid; });
    if (token()) fetch(API + '/api/favourites/' + encodeURIComponent(lid), { method: on ? 'POST' : 'DELETE', headers: { Authorization: 'Bearer ' + token() } }).catch(function () {});
    else localFavs(favs);
    return on;
  }

  // ---- Lightbox ----
  var gallery = [], gi = 0;
  function openLbx(i) { if (!gallery.length) return; gi = (i + gallery.length) % gallery.length; $('lbx-img').src = gallery[gi]; $('lbx-n').textContent = (gi + 1) + ' / ' + gallery.length; $('lbx').classList.add('open'); document.body.style.overflow = 'hidden'; $('lbx-close').focus(); }
  function closeLbx() { $('lbx').classList.remove('open'); document.body.style.overflow = ''; }
  $('lbx-close').addEventListener('click', closeLbx);
  $('lbx-prev').addEventListener('click', function () { openLbx(gi - 1); });
  $('lbx-next').addEventListener('click', function () { openLbx(gi + 1); });
  $('lbx').addEventListener('click', function (e) { if (e.target === $('lbx')) closeLbx(); });
  document.addEventListener('keydown', function (e) {
    if (!$('lbx').classList.contains('open')) return;
    if (e.key === 'Escape') closeLbx(); else if (e.key === 'ArrowLeft') openLbx(gi - 1); else if (e.key === 'ArrowRight') openLbx(gi + 1);
  });
  var tx = null;
  $('lbx').addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  $('lbx').addEventListener('touchend', function (e) { if (tx == null) return; var dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) openLbx(gi + (dx < 0 ? 1 : -1)); tx = null; });

  if (!id) { panel.innerHTML = '<p class="dc-sub" style="padding:50px;text-align:center">No property specified. <a href="/browse.html">Browse all listings</a></p>'; return; }

  Promise.all([fetch(API + '/api/listings/' + id).then(function (r) { return r.json(); }), loadFavs()]).then(function (res) {
    var l = res[0];
    if (!l || l.error) { panel.innerHTML = '<div class="empty-box" style="padding:60px 20px;text-align:center"><h1 style="font-size:1.4rem">This property isn’t available</h1><p class="dc-sub">It may have been rented, sold or taken down.</p><p><a class="btn" href="/browse.html">Browse other homes</a></p></div>'; return; }
    render(l);
    loadSimilar(l);
  }).catch(function () {
    panel.innerHTML = '<p class="dc-sub" style="padding:50px;text-align:center">Could not load this property. Check your connection and try again.</p>';
  });

  function render(l) {
    document.title = l.title + ' | NestKey';
    var isRent = l.deal === 'rent', isSale = l.deal === 'sale' || l.deal === 'land';
    var deal = l.deal === 'sale' ? 'For sale' : (l.deal === 'land' ? 'Land for sale' : 'For rent');
    var town = l.location || l.region || '', county = l.county || '';
    var place = [town, county].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(', ');
    var per = isRent ? '<small>/month</small>' : '';

    // Breadcrumb
    var cr = '<a href="/browse.html">Browse</a>';
    if (county) cr += '<span aria-hidden="true">›</span><a href="/browse.html?county=' + encodeURIComponent(county) + '">' + esc(county) + '</a>';
    if (town && town !== county) cr += '<span aria-hidden="true">›</span><a href="/browse.html?' + (county ? 'county=' + encodeURIComponent(county) + '&' : '') + 'town=' + encodeURIComponent(town) + '">' + esc(town) + '</a>';
    $('pp-crumbs').innerHTML = cr;

    // Photos: main photos first, then room photos (no duplicates)
    gallery = [];
    (l.photos || []).concat.apply(l.photos || [], (l.rooms || []).map(function (r) { return r.photos || []; })).forEach(function (u) { if (u && gallery.indexOf(u) < 0) gallery.push(u); });
    var g = '';
    if (gallery.length) {
      var shown = gallery.slice(0, 5);
      g = '<div class="pp-gallery n' + shown.length + '">' + shown.map(function (u, i) {
        return '<button type="button" class="g' + i + '" data-lbx="' + i + '" aria-label="Open photo ' + (i + 1) + ' of ' + gallery.length + '"><img src="' + esc(u) + '" alt="' + (i === 0 ? esc(l.title) : '') + '"' + (i ? ' loading="lazy"' : '') + '></button>';
      }).join('') + (gallery.length > 1 ? '<button type="button" class="pp-all" data-lbx="0">' + IC.grid + 'Show all ' + gallery.length + ' photos</button>' : '') + '</div>';
    } else g = '<div class="pp-nophoto">No photos yet</div>';

    var tags = '<span class="pp-tag">' + deal + '</span>' + (l.verified ? '<span class="pp-tag">✓ Verified</span>' : '') +
      (l.featured ? '<span class="pp-tag gold">Featured</span>' : '') + (l.tier === 'showcase' ? '<span class="pp-tag navy">Video tour</span>' : '');
    var saved = favs.indexOf(String(l.id)) > -1;
    var top = '<div class="pp-top"><div><h1>' + esc(l.title) + '</h1>' +
      '<div class="pp-loc">' + (place ? IC.pin + '<span>' + esc(place) + '</span>' : '') + '<span class="pp-tags">' + tags + '</span></div></div>' +
      '<div class="pp-tools"><button type="button" class="pp-tool' + (saved ? ' on' : '') + '" id="pp-save" aria-pressed="' + saved + '">' + IC.heart + '<span>' + (saved ? 'Saved' : 'Save') + '</span></button>' +
      '<button type="button" class="pp-tool" id="pp-share">' + IC.share + '<span>Share</span></button></div></div>';

    // Key facts
    var facts = [];
    if (l.type) facts.push(['Type', esc(l.type)]);
    if (l.deal !== 'land') {
      if (l.beds != null && l.beds !== '') facts.push(['Bedrooms', Number(l.beds) === 0 ? 'Studio / bedsitter' : l.beds]);
      if (l.baths) facts.push(['Bathrooms', l.baths]);
      if (l.roomCount) facts.push(['Rooms in total', l.roomCount]);
    }
    if (l.size) facts.push(['Plot size', esc(l.size)]);
    if (place) facts.push(['Location', esc(place)]);
    var factsHtml = '<section class="pp-s-facts"><h2>Key facts</h2><div class="pp-facts">' + facts.map(function (f) { return '<div class="pp-fact"><span>' + f[0] + '</span><strong>' + f[1] + '</strong></div>'; }).join('') + '</div></section>';

    var descTxt = String(l.description || '').trim();
    var descHtml = descTxt ? '<section class="pp-s-about"><h2>About this property</h2><div class="pp-desc" id="pp-desc">' +
      descTxt.split(/\n+/).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div><button type="button" class="pp-more" id="pp-more" hidden>Read more</button></section>' : '';

    var vids = (l.videos || []);
    var videoHtml = vids.length ? '<section><h2>Video tour</h2>' + vids.map(function (u) { return '<video class="pp-video" controls preload="metadata" src="' + esc(u) + '"></video>'; }).join('') + '</section>' : '';

    var roomsHtml = '';
    if (l.rooms && l.rooms.length) {
      var parts = l.rooms.map(function (r) {
        if (!(r.photos && r.photos.length) && !(r.videos && r.videos.length) && !r.description) return '';
        return '<div class="pp-room"><h3>' + esc(r.label || 'Room') + '</h3>' + (r.description ? '<p>' + esc(r.description) + '</p>' : '') +
          '<div class="pp-media">' + (r.videos || []).map(function (u) { return '<video controls preload="metadata" src="' + esc(u) + '"></video>'; }).join('') +
          (r.photos || []).map(function (u) { return '<button type="button" data-lbx="' + gallery.indexOf(u) + '"><img src="' + esc(u) + '" alt="' + esc(r.label || 'Room') + '" loading="lazy"></button>'; }).join('') + '</div></div>';
      }).join('');
      if (parts) roomsHtml = '<section><h2>Room by room</h2>' + parts + '</section>';
    }

    var hasGeo = l.lat != null && l.lng != null && l.lat !== '' && l.lng !== '';
    var mapHtml = hasGeo ? '<section><h2>Location</h2><div id="detail-map" class="detail-map"></div><div class="pp-dir">' +
      '<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&amp;destination=' + l.lat + ',' + l.lng + '">Get directions</a>' +
      '<a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&amp;query=' + l.lat + ',' + l.lng + '">Open in Google Maps</a></div></section>'
      : (place ? '<section><h2>Location</h2><p class="pp-desc">' + esc(place) + '. Ask the owner for the exact location before you visit.</p></section>' : '');

    // Contact card
    var owner = (l.submitter && l.submitter.name) || 'the owner';
    var phone = l.submitter && l.submitter.phone;
    var wa = waNumber(phone);
    var waText = 'Hi' + (l.submitter && l.submitter.name ? ' ' + String(l.submitter.name).split(' ')[0] : '') + ', I saw your listing "' + l.title + '" on NestKey. Is it still available?';
    var waHref = wa ? 'https://wa.me/' + wa + '?text=' + encodeURIComponent(waText) : '';
    var acts = '';
    if (wa) acts += '<a class="btn wa" target="_blank" rel="noopener" href="' + waHref + '">' + IC.wa + 'WhatsApp</a>';
    if (phone) acts += '<a class="btn ghost" href="tel:' + esc(telNumber(phone)) + '">' + IC.phone + 'Call</a>';
    if (isSale) acts += '<button type="button" class="btn ghost wide" id="pay-house">' + IC.cash + 'Buy / pay for this property</button>';
    var safe = isSale
      ? 'Before paying for land or a house, <a href="/verify.html">verify the title deed</a> and visit with your own lawyer.'
      : 'Never send a deposit before you’ve viewed the house in person. <a href="/blog-avoid-rental-scams-kenya.html">How to avoid rental scams</a>';
    var card = '<aside class="pp-side"><div class="pp-card" id="contact">' +
      '<div class="pp-price">' + money(l.price) + per + '</div><div class="pp-deal">' + deal + (l.type ? ' · ' + esc(l.type) : '') + '</div>' +
      '<div class="pp-owner"><div class="pp-avatar" aria-hidden="true">' + esc(String(owner).charAt(0).toUpperCase()) + '</div><div><strong>Listed by ' + esc(owner) + '</strong><span>Contact them directly. NestKey doesn’t charge you a viewing fee.</span></div></div>' +
      (acts ? '<div class="pp-actions">' + acts + '</div>' : '') +
      '<div class="pp-form"><h3>Send an enquiry</h3>' +
      '<input id="enq-name" placeholder="Your name" autocomplete="name">' +
      '<input id="enq-phone" placeholder="Your phone number" inputmode="tel" autocomplete="tel">' +
      '<textarea id="enq-msg">Hi, is this property still available? I’d like to arrange a viewing.</textarea>' +
      '<div class="status" id="enq-status"></div><button type="button" class="btn" id="enq-send">Send enquiry</button></div>' +
      '<p class="pp-safe">' + safe + '</p></div></aside>';

    panel.innerHTML = top + g + '<div class="pp-grid"><div class="pp-main">' + factsHtml + descHtml + videoHtml + roomsHtml + mapHtml + '</div>' + card + '</div>';

    // Phone bar
    var bar = $('pp-bar');
    bar.innerHTML = '<div class="pp-bar-price">' + money(l.price) + per + '</div>' +
      (wa ? '<a class="btn wa" target="_blank" rel="noopener" href="' + waHref + '">' + IC.wa + 'WhatsApp</a>' : '') +
      (phone ? '<a class="btn ghost" href="tel:' + esc(telNumber(phone)) + '" aria-label="Call ' + esc(owner) + '">' + IC.phone + '</a>' : '<a class="btn" href="#contact">Enquire</a>');
    bar.hidden = false;

    // Wire up
    Array.prototype.forEach.call(panel.querySelectorAll('[data-lbx]'), function (b) {
      b.addEventListener('click', function () { var i = Number(b.getAttribute('data-lbx')); openLbx(i >= 0 ? i : 0); });
    });
    var d = $('pp-desc'), more = $('pp-more');
    if (d && more && d.scrollHeight > 200) {
      d.classList.add('clamped'); more.hidden = false;
      more.addEventListener('click', function () { var c = d.classList.toggle('clamped'); more.textContent = c ? 'Read more' : 'Show less'; });
    }
    $('pp-save').addEventListener('click', function () {
      var on = toggleFav(l.id), b = $('pp-save');
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.querySelector('span').textContent = on ? 'Saved' : 'Save';
    });
    $('pp-share').addEventListener('click', function () {
      var url = location.href.split('#')[0], b = $('pp-share');
      if (navigator.share) { navigator.share({ title: l.title, text: l.title + ' on NestKey', url: url }).catch(function () {}); return; }
      var done = function () { b.querySelector('span').textContent = 'Link copied'; setTimeout(function () { b.querySelector('span').textContent = 'Share'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(function () { prompt('Copy this link:', url); });
      else prompt('Copy this link:', url);
    });
    $('enq-send').addEventListener('click', function () {
      var st = $('enq-status');
      if (($('enq-phone').value || '').replace(/\D/g, '').length < 9) { st.className = 'status show err'; st.textContent = 'Add your phone number so the owner can reach you.'; return; }
      st.className = 'status show info'; st.textContent = 'Sending…';
      fetch(API + '/api/listings/' + l.id + '/enquire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: $('enq-name').value, phone: $('enq-phone').value, message: $('enq-msg').value }) })
        .then(function (r) { return r.json(); }).then(function (res) {
          if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not send');
          st.className = 'status show ok'; st.textContent = 'Sent. ' + (l.submitter && l.submitter.name ? String(l.submitter.name).split(' ')[0] : 'The owner') + ' will get your details and contact you.';
        }).catch(function (err) { st.className = 'status show err'; st.textContent = err.message || 'Could not send. Please try again.'; });
    });
    if ($('pay-house')) $('pay-house').addEventListener('click', function () { payFlow(l); });

    if (hasGeo && window.L) {
      setTimeout(function () {
        try {
          var dm = L.map('detail-map', { scrollWheelZoom: false }).setView([Number(l.lat), Number(l.lng)], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(dm);
          L.marker([Number(l.lat), Number(l.lng)]).addTo(dm); dm.invalidateSize();
        } catch (e) {}
      }, 120);
    }
  }

  // Buyer pays the seller directly; we record it (same flow as before).
  function payFlow(l) {
    fetch(API + '/api/rent/' + l.id + '/payinfo').then(function (r) { return r.json(); }).then(function (info) {
      var ov = document.createElement('div'); ov.className = 'sub-modal open';
      if (!info || info.error) {
        ov.innerHTML = '<div class="sub-card"><h3>Payments unavailable</h3><p class="dc-sub">' + esc(info && info.error ? info.error : 'The seller has not set up payments yet. Contact them directly.') + '</p><button class="btn block" id="pf-close">Close</button></div>';
        document.body.appendChild(ov); ov.querySelector('#pf-close').onclick = function () { ov.remove(); }; return;
      }
      var pt = info.payTo || {};
      var instr = pt.method === 'mpesa'
        ? 'Pay by <strong>M-Pesa</strong> to <strong>' + esc(pt.mpesa || '') + '</strong><br><span class="dc-sub">' + esc(pt.name || '') + '</span>'
        : 'Pay to <strong>' + esc(pt.bankName || '') + '</strong><br>' + esc(pt.accountName || '') + ' · ' + esc(pt.accountNumber || '');
      var rate = Math.round((info.commissionRate || 0.025) * 1000) / 10;
      ov.innerHTML = '<div class="sub-card"><h3>Buy this property</h3><div class="payto-box">' + instr + '</div>' +
        '<label>Amount (KSh)</label><input id="pf-amount" type="number" value="' + esc(info.amount || '') + '">' +
        '<label>Your name</label><input id="pf-name" placeholder="Your name">' +
        '<label>Your phone</label><input id="pf-phone" placeholder="07xx xxx xxx">' +
        '<label>M-Pesa / reference code (optional)</label><input id="pf-code" placeholder="e.g. QeteXXXX">' +
        '<p class="dc-sub">Pay the seller using the details above, then tap “I’ve paid” so we record it. NestKey charges the seller ' + rate + '% commission separately.</p>' +
        '<div class="status" id="pf-status"></div><div class="sub-actions"><button class="btn ghost" id="pf-cancel">Cancel</button><button class="btn block" id="pf-done">I’ve paid</button></div></div>';
      document.body.appendChild(ov);
      ov.querySelector('#pf-cancel').onclick = function () { ov.remove(); };
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
      ov.querySelector('#pf-done').onclick = function () {
        var st = ov.querySelector('#pf-status');
        if ((ov.querySelector('#pf-phone').value || '').trim().length < 7) { st.className = 'status show err'; st.textContent = 'Add your phone number.'; return; }
        st.className = 'status show info'; st.textContent = 'Recording…';
        fetch(API + '/api/rent/' + l.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: ov.querySelector('#pf-name').value, phone: ov.querySelector('#pf-phone').value, amount: ov.querySelector('#pf-amount').value, method: ov.querySelector('#pf-code').value }) })
          .then(function (r) { return r.json(); }).then(function (res) {
            if (!res || res.error) throw new Error(res && res.error ? res.error : 'Could not record');
            ov.remove(); if (window.nkShowRating) window.nkShowRating('payment');
          }).catch(function (err) { st.className = 'status show err'; st.textContent = err.message; });
      };
    }).catch(function () {});
  }

  // Similar homes: same county and deal, then same deal anywhere.
  function cardHtml(x) {
    var img = (x.photos && x.photos[0]) || '';
    var dl = x.deal === 'sale' ? 'For sale' : (x.deal === 'land' ? 'Land' : 'For rent');
    var place = [x.location || x.region, x.county].filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(', ');
    var facts = x.deal === 'land' ? (x.size ? '<span>' + esc(x.size) + '</span>' : '')
      : (x.beds ? '<span>' + IC.bed + ' ' + x.beds + ' bed</span>' : (x.type ? '<span>' + IC.home + ' ' + esc(x.type) + '</span>' : '')) + (x.baths ? '<span>' + IC.bath + ' ' + x.baths + ' bath</span>' : '');
    return '<article class="lcard"><div class="lc-media">' + (img ? '<img loading="lazy" src="' + esc(img) + '" alt="">' : '') +
      '<div class="lc-badges"><span class="lc-badge deal">' + dl + '</span></div></div>' +
      '<div class="lc-body"><div class="lc-price">' + money(x.price) + (x.deal === 'rent' ? '<small>/month</small>' : '') + '</div>' +
      '<h3 class="lc-title"><a href="/property/' + encodeURIComponent(x.id) + '">' + esc(x.title) + '</a></h3>' +
      (place ? '<div class="lc-loc">' + IC.pin + ' ' + esc(place) + '</div>' : '') + (facts ? '<div class="lc-facts">' + facts + '</div>' : '') + '</div></article>';
  }
  function loadSimilar(l) {
    var q = function (params) { return fetch(API + '/api/listings?' + params + '&limit=12').then(function (r) { return r.json(); }).then(function (d) { return (d && d.items) || []; }).catch(function () { return []; }); };
    var base = 'deal=' + encodeURIComponent(l.deal || '');
    q(base + (l.county ? '&county=' + encodeURIComponent(l.county) : '')).then(function (a) {
      a = a.filter(function (x) { return String(x.id) !== String(l.id); });
      return a.length >= 4 ? a : q(base).then(function (b) {
        var seen = {}; return a.concat(b).filter(function (x) { if (String(x.id) === String(l.id) || seen[x.id]) return false; seen[x.id] = 1; return true; });
      });
    }).then(function (items) {
      if (!items.length) return;
      $('pp-similar-grid').innerHTML = items.slice(0, 4).map(cardHtml).join('');
      $('pp-similar').hidden = false;
    });
  }
})();
