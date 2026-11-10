/* NestKey dashboard layout: sections (tabs), sidebar counts, "needs attention",
   overview lists and property filters. Data comes from app.js via nk:* events. */
(function () {
  var root = document.getElementById('dashboard'); if (!root) return;
  var TABS = ['overview', 'properties', 'enquiries', 'add', 'payments'];
  var data = { listings: null, leads: null, summary: null, txns: null, profile: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  // ---- Sections ----
  function show(tab, opts) {
    if (TABS.indexOf(tab) < 0) tab = 'overview';
    Array.prototype.forEach.call(root.querySelectorAll('.dash-panel'), function (p) { p.hidden = p.getAttribute('data-panel') !== tab; });
    Array.prototype.forEach.call(root.querySelectorAll('.ds-nav [data-tab]'), function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && b.scrollIntoView && window.innerWidth < 980) { try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} }
    });
    if (location.hash.slice(1) !== tab) { try { history.replaceState(null, '', '#' + tab); } catch (e) { location.hash = tab; } }
    // Leaflet needs a nudge when its map becomes visible.
    if (tab === 'add') setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 30);
    if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
  }
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]');
    if (t && root.contains(t)) { e.preventDefault(); show(t.getAttribute('data-tab')); }
  });
  window.addEventListener('hashchange', function () { show(location.hash.slice(1), { keepScroll: true }); });
  document.addEventListener('nk:tab', function (e) { show(e.detail); });

  // ---- Sidebar identity ----
  var u = null; try { u = JSON.parse(localStorage.getItem('hh_user') || 'null'); } catch (e) {}
  if (u) {
    var name = u.name || u.company || 'Your account';
    if ($('ds-name')) $('ds-name').textContent = name;
    if ($('ds-avatar')) $('ds-avatar').textContent = String(name).trim().charAt(0).toUpperCase() || 'N';
    if ($('hello')) $('hello').textContent = 'Welcome, ' + String(name).split(' ')[0];
  }

  // ---- Property filter chips ----
  var currentFilter = 'all';
  function applyFilter() {
    Array.prototype.forEach.call(document.querySelectorAll('#my-listings .prop-row'), function (r) {
      r.hidden = currentFilter !== 'all' && r.getAttribute('data-status') !== currentFilter;
    });
  }
  var chips = $('prop-filter');
  if (chips) chips.addEventListener('click', function (e) {
    var c = e.target.closest('[data-filter]'); if (!c) return;
    currentFilter = c.getAttribute('data-filter');
    Array.prototype.forEach.call(chips.querySelectorAll('.chip'), function (x) { x.classList.toggle('on', x === c); });
    applyFilter();
  });
  function setFilter(f) {
    var c = chips && chips.querySelector('[data-filter="' + f + '"]'); if (c) c.click();
  }

  // ---- Counts, attention, overview ----
  function setCount(id, n) { var el = $(id); if (!el) return; el.textContent = n > 99 ? '99+' : String(n); el.hidden = !(n > 0); }

  function renderAttention() {
    var box = $('attention'); if (!box) return;
    var items = [];
    var unconfirmed = (data.txns || []).filter(function (t) { return t.invoiceStatus === 'unconfirmed'; }).length;
    var drafts = (data.listings || []).filter(function (l) { return l.status === 'draft'; }).length;
    var hasSales = (data.listings || []).some(function (l) { return l.deal === 'sale' || l.deal === 'land'; });
    if (unconfirmed) items.push({ tone: 'warn', text: unconfirmed + (unconfirmed === 1 ? ' sale is' : ' sales are') + ' waiting for you to confirm', go: 'payments', btn: 'Review' });
    if (drafts) items.push({ tone: 'info', text: drafts + (drafts === 1 ? ' property is' : ' properties are') + ' saved as a draft and not visible yet', go: 'properties', filter: 'draft', btn: 'Publish' });
    if (data.profile && !data.profile.payoutMethod && hasSales) items.push({ tone: 'info', text: 'Add where buyers should pay you for properties you’re selling', go: 'payments', btn: 'Add details' });
    if (data.summary && !data.summary.subscription) items.push({ tone: 'info', text: 'Choose a plan so you can publish your properties', href: '/services.html', btn: 'See plans' });
    setCount('cnt-pay', unconfirmed);
    if (!items.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<h2>Needs your attention</h2>' + items.map(function (it, i) {
      var btn = it.href ? '<a class="mini-btn primary" href="' + it.href + '">' + it.btn + '</a>'
        : '<button type="button" class="mini-btn primary" data-att="' + i + '">' + it.btn + '</button>';
      return '<div class="att-item ' + it.tone + '"><span class="att-dot" aria-hidden="true"></span><span class="att-text">' + esc(it.text) + '</span>' + btn + '</div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-att]'), function (b) {
      b.addEventListener('click', function () {
        var it = items[Number(b.getAttribute('data-att'))];
        show(it.go); if (it.filter) setFilter(it.filter);
      });
    });
  }

  function ago(t) {
    var s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
    if (!(s >= 0)) return '';
    if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  function titleOf(id) {
    var l = (data.listings || []).filter(function (x) { return String(x.id) === String(id); })[0];
    return l ? l.title : '';
  }

  function renderOverview() {
    var ol = $('ov-leads');
    if (ol && data.leads) {
      ol.innerHTML = !data.leads.length ? '<p class="empty">No enquiries yet. They’ll appear here as soon as someone asks.</p>' :
        data.leads.slice(0, 4).map(function (l) {
          var t = titleOf(l.listingId);
          return '<button type="button" class="ov-item" data-tab="enquiries"><span class="lr-avatar sm" aria-hidden="true">' + esc((l.name || 'S').charAt(0).toUpperCase()) + '</span>' +
            '<span class="ov-main"><strong>' + esc(l.name || 'Someone') + '</strong><span>' + esc(t || l.message || '') + '</span></span>' +
            '<span class="ov-side">' + esc(ago(l.createdAt)) + '</span></button>';
        }).join('');
    }
    var op = $('ov-props');
    if (op && data.listings) {
      var top = data.listings.slice().sort(function (a, b) { return (b.views || 0) - (a.views || 0); }).slice(0, 4);
      op.innerHTML = !top.length ? '<p class="empty">No properties yet. <button type="button" class="link-btn" data-tab="add">Add your first one</button></p>' :
        top.map(function (l) {
          return '<button type="button" class="ov-item" data-tab="properties">' +
            '<span class="ov-thumb">' + (l.photos && l.photos[0] ? '<img src="' + esc(l.photos[0]) + '" alt="" loading="lazy">' : '') + '</span>' +
            '<span class="ov-main"><strong>' + esc(l.title) + '</strong><span>' + (l.status === 'published' ? 'Published' : 'Draft') + ' · ' + esc(l.region || '') + '</span></span>' +
            '<span class="ov-side"><strong>' + (l.views || 0) + '</strong> views</span></button>';
        }).join('');
    }
  }

  function refresh() {
    if (data.listings) setCount('cnt-props', data.listings.length);
    if (data.leads) setCount('cnt-leads', data.leads.length);
    renderAttention(); renderOverview(); applyFilter();
  }
  document.addEventListener('nk:listings', function (e) { data.listings = e.detail || []; refresh(); });
  document.addEventListener('nk:leads', function (e) { data.leads = e.detail || []; refresh(); });
  document.addEventListener('nk:summary', function (e) { data.summary = e.detail || {}; refresh(); });
  document.addEventListener('nk:transactions', function (e) { data.txns = e.detail || []; refresh(); });
  document.addEventListener('nk:profile', function (e) { data.profile = e.detail || {}; refresh(); });

  show(location.hash.slice(1) || 'overview', { keepScroll: true });
})();
