// Kenyan phone numbers → 2547XXXXXXXX / 2541XXXXXXXX ('' if not valid).
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D+/g, '');
  if (!d) return '';
  if (d.startsWith('254')) { /* ok */ }
  else if (d.startsWith('0')) d = '254' + d.slice(1);
  else if (d.startsWith('7') || d.startsWith('1')) d = '254' + d;
  return /^254(7|1)\d{8}$/.test(d) ? d : '';
}
module.exports = { normalizePhone };
