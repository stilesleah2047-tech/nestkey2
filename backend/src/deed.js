// Title-deed numbers. Kenyan deeds are written many ways ("NAIROBI/BLOCK 123/456",
// "Nairobi/Block123/456"), so we compare a key made of letters and digits only.
function deedKey(v) {
  const k = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return k.length >= 4 ? k.slice(0, 80) : '';
}
// What the lister typed, tidied up, for their own dashboard and for admins.
function cleanDeed(v) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}
module.exports = { deedKey, cleanDeed };
