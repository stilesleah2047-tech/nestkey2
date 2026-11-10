/* NestKey homepage extras: header dropdowns, saved-homes count, WhatsApp alerts. */
(function () {
  var API = window.NESTKEY_API || '';

  // Hero photo from home-photos.js (so it can be changed in one place).
  var P = window.NESTKEY_PHOTOS, hero = document.querySelector('.hero');
  if (P && P.hero && hero && window.nestkeyPhotoUrl) {
    hero.style.setProperty('--hero-photo', 'url("' + window.nestkeyPhotoUrl(P.hero, 2000) + '")');
    hero.style.setProperty('--hero-photo-sm', 'url("' + window.nestkeyPhotoUrl(P.hero, 1000) + '")');
  }

  // Log in + Sign up buttons (app.js renders a single "Sign in" link; we split it here).
  (function () {
    var el = document.getElementById('navauth'); if (!el) return;
    var u = null; try { u = JSON.parse(localStorage.getItem('hh_user') || 'null'); } catch (e) {}
    if (u) { var a = el.querySelector('a'); if (a) a.className = 'nav-signup'; return; }
    el.innerHTML = '<a href="/account.html" class="nav-login"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>Log in</a>' +
      '<a href="/account.html" class="nav-signup">Sign up</a>';
  })();

  // County cards: app.js renders name + area count; add the photo and layout here.
  var SCENES = ['nairobi', 'kiambu', 'kajiado', 'machakos', 'mombasa', 'kilifi', 'kisumu', 'nakuru', 'uasin-gishu', 'nyeri'];
  function decorateCounties(grid) {
    var photos = (window.NESTKEY_PHOTOS && window.NESTKEY_PHOTOS.counties) || {};
    Array.prototype.forEach.call(grid.querySelectorAll('.county-card:not([data-done])'), function (card) {
      card.setAttribute('data-done', '1');
      var nameEl = card.querySelector('.cc-name'), subEl = card.querySelector('.cc-sub');
      var slug = String(nameEl ? nameEl.textContent : '').trim().toLowerCase().replace(/[^a-z]+/g, '-');
      var drawn = '/assets/counties/' + (SCENES.indexOf(slug) >= 0 ? slug : 'kenya') + '.svg';
      var img = document.createElement('img');
      img.className = 'cc-img'; img.alt = ''; img.loading = 'lazy'; img.width = 600; img.height = 400;
      img.addEventListener('error', function () { if (img.getAttribute('src') !== drawn) img.src = drawn; });
      img.src = photos[slug] && window.nestkeyPhotoUrl ? window.nestkeyPhotoUrl(photos[slug], 600, 400) : drawn;
      var text = document.createElement('span'); text.className = 'cc-text';
      if (nameEl) text.appendChild(nameEl);
      if (subEl) text.appendChild(subEl);
      card.innerHTML = ''; card.appendChild(img); card.appendChild(text);
    });
  }
  var grid = document.getElementById('county-grid');
  if (grid) {
    decorateCounties(grid);
    new MutationObserver(function () { decorateCounties(grid); }).observe(grid, { childList: true });
  }

  // Header dropdowns (Browse, Services): click/tap to open, Esc or outside click to close.
  var dds = document.querySelectorAll('.nav-dd');
  function closeAll(except) {
    Array.prototype.forEach.call(dds, function (dd) {
      if (dd === except) return;
      dd.classList.remove('open');
      var b = dd.querySelector('.nav-dd-btn'); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  Array.prototype.forEach.call(dds, function (dd) {
    var btn = dd.querySelector('.nav-dd-btn');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !dd.classList.contains('open');
      closeAll(dd);
      dd.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.nav-dd')) closeAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.nav-dd.open .nav-dd-btn');
    closeAll(); if (open) open.focus();
  });

  // Saved homes count on the heart.
  function showCount(n) {
    var el = document.getElementById('saved-count'); if (!el) return;
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = !(n > 0);
  }
  var token = null;
  try { token = localStorage.getItem('hh_token'); } catch (e) {}
  if (token) {
    fetch(API + '/api/favourites', { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.ids) showCount(d.ids.length); })
      .catch(function () {});
  } else {
    try { showCount(JSON.parse(localStorage.getItem('nk_favs') || '[]').length); } catch (e) {}
  }

  // "Get new listings on WhatsApp": opens a chat with the area pre-filled.
  var form = document.getElementById('wa-alert');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var area = document.getElementById('wa-area').value.trim();
    if (!area) return;
    var msg = 'Hi NestKey, please message me when a home is listed in: ' + area;
    window.open('https://wa.me/254795721845?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  // Find houses on Enter from any search field.
  ['f-county', 'f-town'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); var go = document.getElementById('f-go'); if (go) go.click(); }
    });
  });
})();
