/* NestKey — Command Center (admin). Standalone: needs only config.js. */
(function () {
  'use strict';

  var API = (window.NESTKEY_API || '').replace(/\/$/, '');
  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------- Auth ---------------- */
  function getToken() { try { return localStorage.getItem('hh_token'); } catch (e) { return null; } }
  function getUser() { try { return JSON.parse(localStorage.getItem('hh_user') || 'null'); } catch (e) { return null; } }
  function clearAuth() { try { localStorage.removeItem('hh_token'); localStorage.removeItem('hh_user'); } catch (e) {} }
  if (!getToken()) { location.replace('/account'); return; }

  function req(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: 'Bearer ' + getToken() }, opts.headers || {});
    return fetch(API + path, opts).then(function (r) {
      if (r.status === 401) { clearAuth(); location.replace('/account'); throw new Error('auth'); }
      if (r.status === 403) { forbidden(); throw new Error('forbidden'); }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function forbidden() {
    $('cc').innerHTML = '<div class="cc-card"><div class="cc-empty">' + ICON.lock +
      '<b>Administrators only</b>This account does not have access to the Command Center.<br><br>' +
      '<a class="cc-btn ghost" href="/dashboard">Go to my dashboard</a></div></div>';
  }

  /* ---------------- Helpers ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var query = '';
  function hl(s) {
    var t = esc(s);
    if (!query) return t;
    var q = esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp('(' + q + ')', 'ig'), '<mark>$1</mark>');
  }
  function has(fields) {
    if (!query) return true;
    var q = query.toLowerCase();
    return fields.some(function (f) { return f != null && String(f).toLowerCase().indexOf(q) !== -1; });
  }
  function money(n) { return 'KSh ' + Math.round(Number(n || 0)).toLocaleString('en-KE'); }
  function moneyKpi(n) {
    n = Number(n || 0);
    var v = n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'
          : n >= 1e4 ? Math.round(n / 1e3) + 'K' : Math.round(n).toLocaleString('en-KE');
    return '<small>KSh</small>' + v;
  }
  function num(n) { return Number(n || 0).toLocaleString('en-KE'); }
  function ago(d) {
    var s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (!isFinite(s)) return '';
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  }
  function dayLabel(d) {
    var t = new Date(d); var today = new Date(); today.setHours(0, 0, 0, 0);
    var x = new Date(t); x.setHours(0, 0, 0, 0);
    var diff = Math.round((today - x) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return t.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'short' });
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase() || '?';
  }
  function within(d, hours) { return (Date.now() - new Date(d).getTime()) < hours * 3600000; }
  function waNumber(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.indexOf('0') === 0) d = '254' + d.slice(1);
    else if (d.length === 9 && /^[17]/.test(d)) d = '254' + d;
    return d;
  }
  function dealLabel(d) { return d === 'rent' ? 'For rent' : d === 'sale' ? 'For sale' : d === 'land' ? 'Land' : (d || '—'); }

  var S = '<svg viewBox="0 0 24 24">';
  var ICON = {
    home: S + '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    user: S + '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    card: S + '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    cash: S + '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    mail: S + '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    star: S + '<path d="M12 3l2.9 6 6.1.9-4.4 4.3 1 6.1L12 17.8 6.4 20.3l1-6.1L3 9.9 9.1 9z"/></svg>',
    shield: S + '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    check: S + '<path d="M5 12l5 5L20 7"/></svg>',
    eye: S + '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: S + '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 005.4-1.6"/></svg>',
    trash: S + '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>',
    ext: S + '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
    phone: S + '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/></svg>',
    chat: S + '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/></svg>',
    arrow: S + '<path d="M9 6l6 6-6 6"/></svg>',
    inbox: S + '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg>',
    lock: S + '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
    sparkle: S + '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
  };
  var FEED_ICON = { listing: ['', ICON.home], user: ['user', ICON.user], subscription: ['money', ICON.card], payment: ['money', ICON.cash], lead: ['', ICON.mail], rating: ['rating', ICON.star] };
  var EMPTY = function (icon, title, text) { return '<div class="cc-empty">' + icon + '<b>' + title + '</b>' + (text || '') + '</div>'; };

  function toast(msg, isErr) {
    var t = $('cc-toast'); t.textContent = msg; t.className = 'cc-toast show' + (isErr ? ' err' : '');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'cc-toast' + (isErr ? ' err' : ''); }, 2800);
  }
  function confirmBox(title, body, okLabel) {
    var d = $('cc-confirm');
    $('cc-confirm-title').textContent = title; $('cc-confirm-body').textContent = body; $('cc-confirm-ok').textContent = okLabel || 'Confirm';
    if (!d.showModal) return Promise.resolve(window.confirm(title + '\n\n' + body));
    return new Promise(function (resolve) {
      d.returnValue = '';
      d.addEventListener('close', function h() { d.removeEventListener('close', h); resolve(d.returnValue === 'ok'); });
      d.showModal();
    });
  }

  /* ---------------- State ---------------- */
  var data = { overview: null, listings: null, users: null, leads: null, activity: null };
  var filt = { listings: 'all', deal: '', users: 'all', activity: 'all' };

  /* ---------------- Views / routing ---------------- */
  var VIEWS = {
    overview: ['Overview', 'What needs you today on NestKey.'],
    listings: ['Listings', 'Review, publish and moderate what appears on the public site.'],
    users: ['Users & KYC', 'Check ID / KRA details and verify trusted landlords and agents.'],
    enquiries: ['Enquiries', 'Messages tenants and buyers sent through listing enquiry forms.'],
    activity: ['Activity', 'Everything happening on NestKey, as it happens.'],
  };
  var current = 'overview';
  function route() {
    var v = (location.hash || '#overview').slice(1);
    if (!VIEWS[v]) v = 'overview';
    current = v;
    qsa('.cc-view').forEach(function (s) { s.hidden = s.getAttribute('data-view') !== v; });
    qsa('.cc-nav a[data-view]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-view') === v); });
    $('cc-view-title').textContent = VIEWS[v][0];
    $('cc-view-sub').textContent = VIEWS[v][1];
    document.title = VIEWS[v][0] + ' · Command Center — NestKey';
    $('ccShell').classList.remove('nav-open');
    window.scrollTo(0, 0);
    renderCurrent();
  }
  function renderCurrent() {
    if (current === 'overview') renderOverview();
    if (current === 'listings') renderListings();
    if (current === 'users') renderUsers();
    if (current === 'enquiries') renderLeads();
    if (current === 'activity') renderActivity();
  }

  /* ---------------- Overview ---------------- */
  function renderOverview() {
    var hour = new Date().getHours();
    var me = getUser() || {};
    var first = String(me.name || '').split(' ')[0];
    $('cc-greeting').textContent = (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening') + (first ? ', ' + first : '');
    $('cc-date').textContent = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    renderAttention();

    var d = data.overview;
    if (d) {
      var s = d.stats || {}, li = s.listings || {}, rt = d.ratings || {};
      var review = (li.draft || 0) + (li.pending || 0);
      var g = function (title, color, items) {
        return '<div class="cc-kpi-group"><h4><i style="background:' + color + '"></i>' + title + '</h4><div class="cc-kpi-row">' +
          items.map(function (k) {
            var tag = k.href ? 'a' : 'div';
            return '<' + tag + ' class="cc-kpi' + (k.warn ? ' warn' : '') + '"' + (k.href ? ' href="' + k.href + '"' : '') + '><span class="n">' + k.n + '</span><span class="l">' + k.l + '</span></' + tag + '>';
          }).join('') + '</div></div>';
      };
      $('cc-kpis').innerHTML =
        g('Marketplace', 'var(--teal)', [
          { n: num(li.published), l: 'Live listings', href: '#listings' },
          { n: num(review), l: 'Awaiting review', href: '#listings', warn: review > 0 },
          { n: num(s.users), l: 'Registered users', href: '#users' },
          { n: num(s.subsActive), l: 'Active plans' },
        ]) +
        g('Money', 'var(--gold)', [
          { n: moneyKpi(s.subRevenue), l: 'Plan revenue (active)' },
          { n: moneyKpi(s.salesValue), l: 'Sales value' },
          { n: moneyKpi(s.commissionCollected), l: 'Commission earned' },
          { n: moneyKpi(s.commissionOwed), l: 'Commission owed', warn: (s.commissionOwed || 0) > 0 },
        ]) +
        g('Engagement', 'var(--blue)', [
          { n: num(s.leads), l: 'Enquiries', href: '#enquiries' },
          { n: rt.count ? Number(rt.average).toFixed(1) + '<small style="margin-left:4px">★</small>' : '—', l: rt.count ? 'Avg rating (' + num(rt.count) + ')' : 'No ratings yet' },
        ]);

      var counties = s.byCounty || [];
      if (!counties.length) $('cc-by-county').innerHTML = EMPTY(ICON.home, 'No live listings yet', 'Counties appear here once listings are published.');
      else {
        var max = Math.max.apply(null, counties.map(function (r) { return r.count; }));
        $('cc-by-county').innerHTML = counties.map(function (r) {
          return '<div class="cc-bar"><span title="' + esc(r.label) + '">' + esc(r.label || '—') + '</span><span class="t"><i style="width:' +
            Math.max(3, Math.round(r.count / max * 100)) + '%"></i></span><b>' + num(r.count) + '</b></div>';
        }).join('');
      }

      var deals = s.byDeal || [];
      var colors = { rent: 'var(--teal)', sale: 'var(--gold)', land: 'var(--blue)' };
      var total = deals.reduce(function (a, r) { return a + r.count; }, 0);
      if (!total) $('cc-by-deal').innerHTML = EMPTY(ICON.home, 'Nothing live yet', '');
      else {
        $('cc-by-deal').innerHTML = '<div class="cc-split">' + deals.map(function (r) {
          return '<i style="flex:' + r.count + ';background:' + (colors[r.label] || 'var(--faint)') + '" title="' + esc(dealLabel(r.label)) + '"></i>';
        }).join('') + '</div><div class="cc-legend">' + deals.map(function (r) {
          return '<div><i style="background:' + (colors[r.label] || 'var(--faint)') + '"></i><span>' + esc(dealLabel(r.label)) + '</span><b>' + num(r.count) +
            '</b><em>' + Math.round(r.count / total * 100) + '%</em></div>';
        }).join('') + '</div>';
      }
    }

    if (data.activity) $('cc-feed-mini').innerHTML = data.activity.length ? data.activity.slice(0, 7).map(function (it) { return feedRow(it); }).join('') : EMPTY(ICON.sparkle, 'No activity yet', '');
    if (data.leads) $('cc-leads-mini').innerHTML = data.leads.length ? data.leads.slice(0, 5).map(function (x) { return leadRow(x); }).join('') : EMPTY(ICON.inbox, 'No enquiries yet', 'They appear here when someone contacts a lister.');
  }

  function renderAttention() {
    var cards = [];
    var L = data.listings, U = data.users, E = data.leads;
    if (L) {
      var r = L.filter(function (l) { return l.status !== 'published'; }).length;
      if (r) cards.push(['#listings', 'gold', ICON.home, r + ' listing' + (r > 1 ? 's' : '') + ' to review', 'Drafts and pending listings not yet live']);
    }
    if (U) {
      var k = U.filter(kycToCheck).length;
      if (k) cards.push(['#users', 'blue', ICON.shield, k + ' KYC check' + (k > 1 ? 's' : ''), 'Users who sent ID / KRA but aren’t verified']);
    }
    if (E) {
      var n = E.filter(function (x) { return within(x.createdAt, 24); }).length;
      if (n) cards.push(['#enquiries', 'teal', ICON.mail, n + ' new enquir' + (n > 1 ? 'ies' : 'y'), 'Received in the last 24 hours']);
    }
    if (!L || !U || !E) { $('cc-attn').innerHTML = ''; return; }
    $('cc-attn').innerHTML = cards.length ? cards.map(function (c) {
      return '<a href="' + c[0] + '"><span class="ic ' + c[1] + '">' + c[2] + '</span><span><b>' + c[3] + '</b><small>' + c[4] + '</small></span><span class="go">' + ICON.arrow + '</span></a>';
    }).join('') : '<a class="all-clear" href="#activity"><span class="ic calm">' + ICON.check + '</span><span><b>All caught up</b><small>No listings, KYC checks or new enquiries waiting on you.</small></span></a>';
  }

  /* ---------------- Listings ---------------- */
  function renderListings() {
    var el = $('cc-listings'), L = data.listings;
    if (!L) return;
    var byDeal = L.filter(function (l) { return !filt.deal || l.deal === filt.deal; });
    var counts = { all: byDeal.length, review: byDeal.filter(function (l) { return l.status !== 'published'; }).length, published: byDeal.filter(function (l) { return l.status === 'published'; }).length };
    qsa('#lf button').forEach(function (b) { b.querySelector('b').textContent = counts[b.getAttribute('data-f')] || ''; });

    var rows = byDeal.filter(function (l) {
      if (filt.listings === 'review' && l.status === 'published') return false;
      if (filt.listings === 'published' && l.status !== 'published') return false;
      return has([l.title, l.region, l.county, l.location, l.deal, l.type, l.status, l.submitter && l.submitter.name]);
    });
    if (!rows.length) {
      el.innerHTML = query ? EMPTY(ICON.home, 'No listings match “' + esc(query) + '”', '') :
        filt.listings === 'review' ? EMPTY(ICON.check, 'Nothing to review', 'Every listing is live.') : EMPTY(ICON.home, 'No listings yet', '');
      return;
    }
    el.innerHTML = '<table class="cc-table"><thead><tr><th>Property</th><th>Type</th><th>Area</th><th>Status</th><th class="num">Views</th><th class="num">Added</th><th></th></tr></thead><tbody>' +
      rows.map(function (l) {
        var photo = l.photos && l.photos[0];
        var pill = l.status === 'published' ? '<span class="cc-pill ok">Live</span>' : l.status === 'pending' ? '<span class="cc-pill pending">Pending</span>' :
          l.status === 'draft' ? '<span class="cc-pill draft">Draft</span>' : '<span class="cc-pill bad">' + esc(l.status) + '</span>';
        var acts = (l.status === 'published'
            ? '<button class="cc-mini" data-a="unpublish" data-id="' + esc(l.id) + '">' + ICON.eyeOff + 'Unpublish</button>'
            : '<button class="cc-mini primary" data-a="publish" data-id="' + esc(l.id) + '">' + ICON.check + 'Publish</button>') +
          '<a class="cc-mini icon" href="/property/' + encodeURIComponent(l.id) + '" target="_blank" rel="noopener" title="Open listing" aria-label="Open listing">' + ICON.ext + '</a>' +
          '<button class="cc-mini danger icon" data-a="delete" data-id="' + esc(l.id) + '" data-t="' + esc(l.title) + '" title="Delete" aria-label="Delete listing">' + ICON.trash + '</button>';
        return '<tr><td class="first"><div class="cc-prop">' +
          (photo ? '<img class="cc-thumb" src="' + esc(photo) + '" alt="" loading="lazy">' : '<span class="cc-thumb">' + ICON.home + '</span>') +
          '<div style="min-width:0"><b><a href="/property/' + encodeURIComponent(l.id) + '" target="_blank" rel="noopener">' + hl(l.title || 'Untitled') + '</a></b><span class="cc-sub">' + money(l.price) +
          (l.verified ? ' · <span style="color:var(--teal-dk);font-weight:700">Verified lister</span>' : '') + '</span></div></div></td>' +
          '<td data-k="Type"><span class="cc-tag">' + hl(dealLabel(l.deal)) + '</span></td>' +
          '<td data-k="Area">' + hl([l.region, l.county].filter(Boolean).join(', ') || '—') + '</td>' +
          '<td data-k="Status">' + pill + '</td>' +
          '<td data-k="Views" class="num">' + num(l.views) + '</td>' +
          '<td data-k="Added" class="num cc-sub">' + (l.createdAt ? ago(l.createdAt) : '—') + '</td>' +
          '<td><div class="cc-acts">' + acts + '</div></td></tr>';
      }).join('') + '</tbody></table>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('#cc-listings button[data-a]');
    if (!b) return;
    var a = b.getAttribute('data-a'), id = b.getAttribute('data-id');
    var go = function () {
      b.disabled = true;
      var p = a === 'delete' ? req('/api/admin/listings/' + encodeURIComponent(id), { method: 'DELETE' })
                             : req('/api/admin/listings/' + encodeURIComponent(id) + '/' + a, { method: 'POST' });
      p.then(function () {
        toast(a === 'publish' ? 'Listing is now live' : a === 'unpublish' ? 'Listing moved to drafts' : 'Listing deleted');
        return Promise.all([loadListings(), loadOverview()]);
      }).catch(function (err) { if (err.message !== 'auth' && err.message !== 'forbidden') toast('Could not update the listing', true); b.disabled = false; });
    };
    if (a === 'delete') confirmBox('Delete this listing?', '“' + (b.getAttribute('data-t') || 'This listing') + '” will be removed permanently. This can’t be undone.', 'Delete').then(function (ok) { if (ok) go(); });
    else go();
  });

  /* ---------------- Users ---------------- */
  function kycToCheck(u) { return !u.verified && !!(u.idNumber || u.kraPin); }
  function renderUsers() {
    var el = $('cc-users'), U = data.users;
    if (!U) return;
    var counts = { all: U.length, kyc: U.filter(kycToCheck).length, unverified: U.filter(function (u) { return !u.verified; }).length, verified: U.filter(function (u) { return u.verified; }).length };
    qsa('#uf button').forEach(function (b) { b.querySelector('b').textContent = counts[b.getAttribute('data-f')] || ''; });

    var rows = U.filter(function (u) {
      if (filt.users === 'kyc' && !kycToCheck(u)) return false;
      if (filt.users === 'unverified' && u.verified) return false;
      if (filt.users === 'verified' && !u.verified) return false;
      return has([u.name, u.email, u.phone, u.role, u.businessName, u.company, u.idNumber, u.kraPin]);
    });
    if (!rows.length) {
      el.innerHTML = query ? EMPTY(ICON.user, 'No users match “' + esc(query) + '”', '') :
        filt.users === 'kyc' ? EMPTY(ICON.shield, 'No KYC checks waiting', 'Users who submit ID / KRA details will appear here.') : EMPTY(ICON.user, 'No users here', '');
      return;
    }
    el.innerHTML = '<table class="cc-table"><thead><tr><th>User</th><th>Role</th><th>ID number</th><th>KRA PIN</th><th class="num">Listings</th><th>Status</th><th></th></tr></thead><tbody>' +
      rows.map(function (u) {
        var status = u.verified ? '<span class="cc-pill ok">Verified</span>' : kycToCheck(u) ? '<span class="cc-pill pending">Check KYC</span>' : '<span class="cc-pill draft">Unverified</span>';
        var act = u.verified
          ? '<button class="cc-mini" data-v="unverify" data-id="' + esc(u.id) + '" data-n="' + esc(u.name || u.email) + '">Remove badge</button>'
          : '<button class="cc-mini primary" data-v="verify" data-id="' + esc(u.id) + '">' + ICON.shield + 'Verify</button>';
        var contact = [u.email, u.phone].filter(Boolean).map(hl).join(' · ');
        return '<tr><td class="first"><div class="cc-person"><span class="cc-avatar">' + esc(initials(u.name || u.email)) + '</span><div style="min-width:0"><b>' + hl(u.name || '—') +
          (u.businessName ? ' <span class="cc-sub">· ' + hl(u.businessName) + '</span>' : '') + '</b><span class="cc-sub">' + contact + '</span></div></div></td>' +
          '<td data-k="Role"><span class="cc-tag">' + hl(u.role || 'user') + '</span></td>' +
          '<td data-k="ID">' + (u.idNumber ? hl(u.idNumber) : '<span class="cc-sub">—</span>') + '</td>' +
          '<td data-k="KRA">' + (u.kraPin ? hl(u.kraPin) : '<span class="cc-sub">—</span>') + '</td>' +
          '<td data-k="Listings" class="num">' + num(u.listings) + '</td>' +
          '<td data-k="Status">' + status + '</td>' +
          '<td><div class="cc-acts">' + act + '</div></td></tr>';
      }).join('') + '</tbody></table>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('#cc-users button[data-v]');
    if (!b) return;
    var v = b.getAttribute('data-v'), id = b.getAttribute('data-id');
    var go = function () {
      b.disabled = true;
      req('/api/admin/users/' + encodeURIComponent(id) + '/' + v, { method: 'POST' }).then(function () {
        toast(v === 'verify' ? 'User verified — their listings now show the badge' : 'Verified badge removed');
        return Promise.all([loadUsers(), loadListings()]);
      }).catch(function (err) { if (err.message !== 'auth' && err.message !== 'forbidden') toast('Could not update the user', true); b.disabled = false; });
    };
    if (v === 'unverify') confirmBox('Remove verified badge?', (b.getAttribute('data-n') || 'This user') + ' and all their listings will lose the verified badge.', 'Remove badge').then(function (ok) { if (ok) go(); });
    else go();
  });

  /* ---------------- Enquiries ---------------- */
  function leadRow(x) {
    var wa = waNumber(x.phone);
    return '<div class="cc-lead"><div><div class="cc-lead-top"><b>' + hl(x.name || 'Someone') + '</b>' +
      (x.phone ? '<span class="cc-sub">' + hl(x.phone) + '</span>' : '') + '<time datetime="' + esc(x.createdAt) + '">' + ago(x.createdAt) + '</time></div>' +
      (x.message ? '<p>' + hl(x.message) + '</p>' : '<p class="cc-sub">No message</p>') +
      (x.listingId ? '<div class="about">About: <a href="/property/' + encodeURIComponent(x.listingId) + '" target="_blank" rel="noopener">' + hl(x.listingTitle || 'View listing') + '</a></div>' : '') +
      '</div><div class="cc-acts">' +
      (x.phone ? '<a class="cc-mini" href="tel:' + esc(String(x.phone).replace(/\s/g, '')) + '">' + ICON.phone + 'Call</a>' : '') +
      (wa ? '<a class="cc-mini" href="https://wa.me/' + wa + '" target="_blank" rel="noopener">' + ICON.chat + 'WhatsApp</a>' : '') +
      '</div></div>';
  }
  function renderLeads() {
    var el = $('cc-leads'), E = data.leads;
    if (!E) return;
    if (E.error) { el.innerHTML = EMPTY(ICON.inbox, 'Enquiries couldn’t load', 'Make sure the backend has been redeployed with the new /api/admin/leads endpoint.'); return; }
    var rows = E.filter(function (x) { return has([x.name, x.phone, x.message, x.listingTitle]); });
    el.innerHTML = rows.length ? rows.map(function (x) { return leadRow(x); }).join('') :
      query ? EMPTY(ICON.inbox, 'No enquiries match “' + esc(query) + '”', '') : EMPTY(ICON.inbox, 'No enquiries yet', 'They appear here when someone contacts a lister.');
  }

  /* ---------------- Activity ---------------- */
  function feedRow(it, isNew) {
    var ic = FEED_ICON[it.kind] || ['', ICON.sparkle];
    return '<div class="cc-feed-row' + (isNew ? ' new' : '') + '"><span class="ic ' + ic[0] + '">' + ic[1] + '</span><p>' + hl(it.text) + '</p><time datetime="' + esc(it.at) + '">' + ago(it.at) + '</time></div>';
  }
  function renderActivity() {
    var el = $('cc-feed'), A = data.activity;
    if (!A) return;
    var rows = A.filter(function (it) {
      var f = filt.activity;
      if (f === 'money' && it.kind !== 'subscription' && it.kind !== 'payment') return false;
      if (f !== 'all' && f !== 'money' && it.kind !== f) return false;
      return has([it.text]);
    });
    if (!rows.length) { el.innerHTML = EMPTY(ICON.sparkle, query ? 'Nothing matches “' + esc(query) + '”' : 'Nothing here yet', ''); return; }
    var out = '', last = '';
    rows.forEach(function (it) {
      var d = dayLabel(it.at);
      if (d !== last) { out += '<div class="cc-day">' + d + '</div>'; last = d; }
      out += feedRow(it);
    });
    el.innerHTML = out;
  }

  /* ---------------- Badges ---------------- */
  function badges() {
    var set = function (id, n) { var b = $(id); b.hidden = !n; b.textContent = n > 99 ? '99+' : n; };
    if (data.listings) set('nb-listings', data.listings.filter(function (l) { return l.status !== 'published'; }).length);
    if (data.users) set('nb-users', data.users.filter(kycToCheck).length);
    if (data.leads && !data.leads.error) set('nb-enquiries', data.leads.filter(function (x) { return within(x.createdAt, 24); }).length);
  }

  /* ---------------- Loading ---------------- */
  function fail(id) { return function (err) { if (err.message === 'auth' || err.message === 'forbidden') return; var el = $(id); if (el) el.innerHTML = '<div class="cc-error">Couldn’t load this. Check your connection and press refresh.</div>'; }; }
  function after() { badges(); renderCurrent(); }
  function loadOverview() { return req('/api/admin/overview').then(function (d) { data.overview = d; after(); }).catch(fail('cc-kpis')); }
  function loadListings() { return req('/api/admin/listings').then(function (d) { data.listings = d.items || []; after(); }).catch(fail('cc-listings')); }
  function loadUsers() { return req('/api/admin/users').then(function (d) { data.users = d.items || []; after(); }).catch(fail('cc-users')); }
  function loadLeads() {
    return req('/api/admin/leads').then(function (d) { data.leads = d.items || []; after(); })
      .catch(function (err) { if (err.message === 'auth' || err.message === 'forbidden') return; data.leads = []; data.leads.error = true; after(); });
  }
  function loadActivity() { return req('/api/admin/activity?limit=80').then(function (d) { data.activity = d.items || []; after(); }).catch(fail('cc-feed')); }
  function loadAll() { return Promise.all([loadOverview(), loadListings(), loadUsers(), loadLeads(), loadActivity()]); }

  /* ---------------- Live updates (SSE) ---------------- */
  function setLive(state, label) {
    var el = $('cc-live'); el.className = 'cc-live ' + state; el.querySelector('span').textContent = label;
    el.title = state === 'ok' ? 'Receiving live updates' : 'Live updates paused — data refreshes every minute';
  }
  function connectLive() {
    if (!window.EventSource) { setLive('off', 'Auto-refresh'); return; }
    var es;
    try { es = new EventSource(API + '/api/stream?token=' + encodeURIComponent(getToken() || '')); } catch (e) { setLive('off', 'Auto-refresh'); return; }
    es.onopen = function () { setLive('ok', 'Live'); };
    es.onerror = function () { setLive('off', 'Reconnecting'); };
    es.addEventListener('activity', function (ev) {
      var it = {}; try { it = JSON.parse(ev.data); } catch (e) {}
      if (!it.text) return;
      it.at = it.at || new Date().toISOString();
      (data.activity = data.activity || []).unshift(it);
      var mini = $('cc-feed-mini');
      if (mini && current === 'overview') {
        var tmp = document.createElement('div'); tmp.innerHTML = feedRow(it, true);
        var empty = mini.querySelector('.cc-empty'); if (empty) mini.innerHTML = '';
        mini.insertBefore(tmp.firstChild, mini.firstChild);
        while (mini.children.length > 7) mini.removeChild(mini.lastChild);
      } else if (current === 'activity') renderActivity();
      var live = $('cc-live'); live.classList.add('flash'); setTimeout(function () { live.classList.remove('flash'); }, 1200);
      loadOverview();
      if (it.kind === 'listing') loadListings();
      if (it.kind === 'user') loadUsers();
      if (it.kind === 'lead') loadLeads();
    });
  }

  /* ---------------- Wiring ---------------- */
  function tabs(id, key, render) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]'); if (!b) return;
      qsa('#' + id + ' button').forEach(function (x) { x.classList.toggle('on', x === b); });
      filt[key] = b.getAttribute('data-f'); render();
    });
  }
  tabs('lf', 'listings', renderListings);
  tabs('uf', 'users', renderUsers);
  tabs('af', 'activity', renderActivity);
  $('ls-deal').addEventListener('change', function () { filt.deal = this.value; renderListings(); });

  var st;
  $('cc-search').addEventListener('input', function () {
    var v = this.value.trim();
    clearTimeout(st);
    st = setTimeout(function () {
      query = v;
      if (query && current === 'overview') { location.hash = '#listings'; return; }
      renderCurrent();
    }, 150);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('cc-search').focus(); }
    if (e.key === 'Escape') {
      $('ccShell').classList.remove('nav-open');
      if (document.activeElement === $('cc-search') && $('cc-search').value) { $('cc-search').value = ''; query = ''; renderCurrent(); }
    }
  });

  $('ccMenu').addEventListener('click', function () { $('ccShell').classList.add('nav-open'); });
  $('ccBackdrop').addEventListener('click', function () { $('ccShell').classList.remove('nav-open'); });
  $('cc-signout').addEventListener('click', function () { clearAuth(); location.href = '/'; });
  $('cc-refresh').addEventListener('click', function () {
    var b = this; b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
    loadAll().then(function () { toast('Up to date'); });
  });

  var me = getUser() || {};
  $('cc-name').textContent = me.name || me.email || 'Admin';
  $('cc-initials').textContent = initials(me.name || me.email || 'A');

  window.addEventListener('hashchange', route);
  route();
  loadAll();
  connectLive();
  setInterval(function () { if (!document.hidden) loadAll(); }, 60000);
  setInterval(function () { qsa('time[datetime]').forEach(function (t) { t.textContent = ago(t.getAttribute('datetime')); }); }, 30000);
})();
