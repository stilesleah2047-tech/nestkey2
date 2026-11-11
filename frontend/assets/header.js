/* NestKey site header: dropdown menus, Log in / Sign up, saved-homes count.
   Shared by every public page. Load after app.js. */
(function () {
  var API = window.NESTKEY_API || '';

  // Log in + Sign up (app.js renders one "Sign in" link; split it on pages that ask for it).
  var auth = document.getElementById('navauth');
  if (auth && auth.classList.contains('navauth-split')) {
    var u = null; try { u = JSON.parse(localStorage.getItem('hh_user') || 'null'); } catch (e) {}
    if (u) { var a = auth.querySelector('a'); if (a) a.className = 'nav-signup'; }
    else {
      auth.innerHTML = '<a href="/account" class="nav-login"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>Log in</a>' +
        '<a href="/account" class="nav-signup">Sign up</a>';
    }
  }

  // Menu button for phones. app.js adds it on most pages; add it here if a page doesn't load app.js.
  var wrap = document.querySelector('.top .wrap'), mainNav = wrap && wrap.querySelector('nav');
  if (wrap && mainNav && !wrap.querySelector('.nav-toggle')) {
    var tb = document.createElement('button');
    tb.className = 'nav-toggle'; tb.setAttribute('aria-label', 'Menu'); tb.setAttribute('aria-expanded', 'false');
    tb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    tb.addEventListener('click', function () {
      var open = mainNav.classList.toggle('open'); tb.classList.toggle('active', open); tb.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mainNav.addEventListener('click', function (e) { if (e.target.closest('a')) { mainNav.classList.remove('open'); tb.classList.remove('active'); } });
    wrap.appendChild(tb);
  }

  // Dropdowns (Browse, Services): click/tap to open, Esc or outside click to close.
  var dds = document.querySelectorAll('.nk-head .nav-dd');
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
    var open = document.querySelector('.nk-head .nav-dd.open .nav-dd-btn');
    closeAll(); if (open) open.focus();
  });

  // Saved homes count on the heart.
  var countEl = document.getElementById('saved-count');
  function showCount(n) {
    if (!countEl) return;
    countEl.textContent = n > 99 ? '99+' : String(n);
    countEl.hidden = !(n > 0);
  }
  if (countEl) {
    var token = null; try { token = localStorage.getItem('hh_token'); } catch (e) {}
    if (token) {
      fetch(API + '/api/favourites', { headers: { Authorization: 'Bearer ' + token } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.ids) showCount(d.ids.length); })
        .catch(function () {});
    } else {
      try { showCount(JSON.parse(localStorage.getItem('nk_favs') || '[]').length); } catch (e) {}
    }
  }
})();
