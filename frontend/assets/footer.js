/* NestKey social links (footer on every page + Contact page).
 *
 * ▶ TO ADD YOUR SOCIAL LINKS, EDIT ONLY THIS LIST.
 *   Paste the full address of each profile between the quotes, e.g.
 *     tiktok:   'https://www.tiktok.com/@nestkey.ke',
 *   Icons are always shown. Until a link is added, tapping that icon
 *   shows "Coming soon"; once added, it opens your profile.
 */
var NESTKEY_SOCIALS = {
  tiktok:    '',
  facebook:  '',
  instagram: 'https://www.instagram.com/nestkey.co.ke/',
};

(function () {
  var NAMES = { tiktok: 'TikTok', facebook: 'Facebook', instagram: 'Instagram' };
  function valid(u) { return /^https:\/\/[^\s"'<>]+$/.test(String(u || '').trim()); }

  function soon(a, name) {
    var tip = a.querySelector('.soon-tip');
    if (!tip) { tip = document.createElement('span'); tip.className = 'soon-tip'; tip.textContent = name + ' coming soon'; a.appendChild(tip); }
    a.classList.add('show-tip');
    clearTimeout(a._t); a._t = setTimeout(function () { a.classList.remove('show-tip'); }, 1800);
  }

  function fill() {
    var urls = [];
    Object.keys(NESTKEY_SOCIALS).forEach(function (k) {
      var url = String(NESTKEY_SOCIALS[k] || '').trim(), ok = valid(url), name = NAMES[k] || k;
      if (ok) urls.push(url);
      Array.prototype.forEach.call(document.querySelectorAll('[data-social="' + k + '"]'), function (a) {
        a.hidden = false;
        if (ok) {
          a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.removeAttribute('role'); a.classList.remove('is-soon');
          a.title = 'NestKey on ' + name;
        } else {
          a.removeAttribute('href'); a.removeAttribute('target');
          a.setAttribute('role', 'button'); a.setAttribute('tabindex', '0'); a.setAttribute('aria-label', name + ' \u2014 coming soon');
          a.classList.add('is-soon'); a.title = name + ' \u2014 coming soon';
          a.addEventListener('click', function (e) { e.preventDefault(); soon(a, name); });
          a.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); soon(a, name); } });
        }
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.foot-social'), function (el) { el.hidden = false; });

    // Tell Google which profiles belong to NestKey (only real links).
    if (urls.length) {
      Array.prototype.forEach.call(document.querySelectorAll('script[type="application/ld+json"]'), function (sc) {
        try {
          var data = JSON.parse(sc.textContent), changed = false;
          (data['@graph'] || [data]).forEach(function (n) { if (n && n['@type'] === 'Organization') { n.sameAs = urls; changed = true; } });
          if (changed) sc.textContent = JSON.stringify(data);
        } catch (e) {}
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll('.foot-year'), function (el) { el.textContent = new Date().getFullYear(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();

  // Show the live sales-commission rate wherever the page mentions it.
  if (document.querySelector('.js-commission')) {
    fetch((window.NESTKEY_API || '') + '/api/config').then(function (r) { return r.json(); }).then(function (c) {
      if (!c || typeof c.commissionRate !== 'number') return;
      var pct = (Math.round(c.commissionRate * 1000) / 10) + '%';
      Array.prototype.forEach.call(document.querySelectorAll('.js-commission'), function (el) { el.textContent = pct; });
    }).catch(function () {});
  }
})();
