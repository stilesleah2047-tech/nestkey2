/* NestKey site footer — social links.
 *
 * ▶ TO ADD OR CHANGE YOUR SOCIAL LINKS, EDIT ONLY THIS LIST.
 *   Paste the full address of each profile between the quotes, e.g.
 *     tiktok:   'https://www.tiktok.com/@nestkey.ke',
 *   Leave a link empty ('') to hide that icon. The whole "Follow us"
 *   row stays hidden until at least one link is filled in.
 */
var NESTKEY_SOCIALS = {
  tiktok:    '',
  facebook:  '',
  instagram: '',
};

(function () {
  function fill() {
    var any = false;
    Object.keys(NESTKEY_SOCIALS).forEach(function (k) {
      var url = String(NESTKEY_SOCIALS[k] || '').trim();
      if (!/^https:\/\//.test(url)) return;
      var links = document.querySelectorAll('[data-social="' + k + '"]');
      Array.prototype.forEach.call(links, function (a) { a.href = url; a.hidden = false; any = true; });
    });
    if (any) Array.prototype.forEach.call(document.querySelectorAll('.foot-social'), function (el) { el.hidden = false; });
    // Tell Google these profiles belong to NestKey (Organization "sameAs").
    if (any) {
      var urls = Object.keys(NESTKEY_SOCIALS).map(function (k) { return String(NESTKEY_SOCIALS[k] || '').trim(); }).filter(function (u) { return /^https:\/\//.test(u); });
      Array.prototype.forEach.call(document.querySelectorAll('script[type="application/ld+json"]'), function (sc) {
        try {
          var data = JSON.parse(sc.textContent), changed = false;
          (data['@graph'] || [data]).forEach(function (n) { if (n && n['@type'] === 'Organization') { n.sameAs = urls; changed = true; } });
          if (changed) sc.textContent = JSON.stringify(data);
        } catch (e) {}
      });
    }
    var y = document.querySelectorAll('.foot-year');
    Array.prototype.forEach.call(y, function (el) { el.textContent = new Date().getFullYear(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
