/* NestKey homepage extras: hero photo, county photo cards, WhatsApp alerts, Enter-to-search. */
(function () {

  // Hero photo from home-photos.js (so it can be changed in one place).
  var P = window.NESTKEY_PHOTOS, hero = document.querySelector('.hero');
  if (P && P.hero && hero && window.nestkeyPhotoUrl) {
    hero.style.setProperty('--hero-photo', 'url("' + window.nestkeyPhotoUrl(P.hero, 2000) + '")');
    hero.style.setProperty('--hero-photo-sm', 'url("' + window.nestkeyPhotoUrl(P.hero, 1000) + '")');
  }

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
