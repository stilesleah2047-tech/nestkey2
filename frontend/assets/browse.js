/* NestKey browse page: "Filters" button on phones + active-filter count. */
(function () {
  var bar = document.getElementById('fbar'), btn = document.getElementById('fbToggle'), n = document.getElementById('fbN');
  if (!bar || !btn) return;
  btn.addEventListener('click', function () {
    var open = bar.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  var ids = ['deal', 'beds', 'minPrice', 'maxPrice'];
  function count() {
    var c = 0;
    ids.forEach(function (id) { var el = document.getElementById(id); if (el && el.value) c++; });
    var s = document.getElementById('sort'); if (s && s.value && s.value !== 'newest') c++;
    if (n) { n.textContent = c; n.hidden = c === 0; }
  }
  ids.concat(['sort']).forEach(function (id) {
    var el = document.getElementById(id); if (el) { el.addEventListener('change', count); el.addEventListener('input', count); }
  });
  document.addEventListener('nk:filters-reset', count);
  count();
})();
