'use strict';

// Robust price parsing for the "asking price" field.
// Accepts plain numbers, currency symbols/words, thousands separators,
// short suffixes (k/m/b) and spelled-out English amounts. Always returns a
// non-negative whole number of shillings (0 when nothing usable is found).
//
// Examples:
//   50000                       -> 50000
//   "KSh 50,000"                -> 50000
//   "Ksh. 2,500,000/="          -> 2500000
//   "50k" / "50 k"              -> 50000
//   "1.2m" / "1.2 million"      -> 1200000
//   "fifty thousand"            -> 50000
//   "two hundred fifty thousand"-> 250000
//   "250 thousand shillings"    -> 250000

var UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
var TENS = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
var SCALES = {
  hundred: 100, k: 1e3, thousand: 1e3, grand: 1e3,
  m: 1e6, mil: 1e6, million: 1e6, millions: 1e6,
  b: 1e9, bn: 1e9, billion: 1e9, billions: 1e9,
};

function parsePrice(input) {
  if (input == null) return 0;
  if (typeof input === 'number') {
    return isFinite(input) && input > 0 ? Math.round(input) : 0;
  }
  var s = String(input).toLowerCase().trim();
  if (!s) return 0;

  // Strip currency words and symbols.
  s = s.replace(/kshs?|kes|shillings?|shs?|bob|usd|dollars?|eur|euros?|gbp|pounds?|ngn|tzs|ugx/g, ' ');
  s = s.replace(/[$\u20ac\u00a3]/g, ' ');
  s = s.replace(/\/[=-]/g, ' '); // 5000/= or 5000/-
  // Drop thousands separators so "50,000" / "2 500 000" become single numbers.
  s = s.replace(/,/g, '');
  s = s.replace(/(\d)\s+(?=\d{3}\b)/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return 0;

  var tokens = s.split(/[\s-]+/).filter(Boolean);
  var total = 0;
  var current = 0;
  var matched = false;

  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    if (t === 'and' || t === 'a' || t === 'of') continue;

    // Numeric token, optionally with an attached suffix (50k, 1.2m).
    var nm = t.match(/^(\d+(?:\.\d+)?)(k|m|b|bn|mil)?$/);
    if (nm) {
      var val = parseFloat(nm[1]);
      if (nm[2]) val *= SCALES[nm[2]];
      current += val;
      matched = true;
      continue;
    }
    if (UNITS[t] != null) { current += UNITS[t]; matched = true; continue; }
    if (TENS[t] != null) { current += TENS[t]; matched = true; continue; }
    if (t === 'hundred') { current = (current || 1) * 100; matched = true; continue; }
    if (SCALES[t] != null) {
      current = (current || 1) * SCALES[t];
      total += current;
      current = 0;
      matched = true;
      continue;
    }
    // Unknown token (e.g. "per", "month") -> ignore.
  }
  total += current;

  if (!matched) {
    var f = parseFloat(s);
    return isFinite(f) && f > 0 ? Math.round(f) : 0;
  }
  return total > 0 ? Math.round(total) : 0;
}

module.exports = { parsePrice: parsePrice };
