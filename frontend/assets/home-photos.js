/* NestKey homepage photos.
 *
 * ▶ TO CHANGE A PHOTO, EDIT ONLY THIS FILE.
 *   Each entry is an Unsplash photo id (the part after "photo-" in an
 *   images.unsplash.com link) or a full image URL, e.g. '/assets/photos/nairobi.jpg'
 *   for a photo you upload yourself.
 *   If a photo ever fails to load, the page quietly falls back to the
 *   drawn version in /assets/counties/ so nothing looks broken.
 *
 * All photos are free to use under the Unsplash License (no attribution required).
 */
window.NESTKEY_PHOTOS = {
  // Hero: modern stone-clad house at dusk (Naksha Banwao)
  hero: '1722421492323-eaf9c401befe',

  counties: {
    'nairobi':     '1611348524140-53c9a25263d6', // Nairobi skyline with KICC (Amani Nation)
    'kiambu':      '1547471080-7cc2caa01a7e',    // Green farmland, golden hour (Damian Patkowski), general Kenya
    'kajiado':     '1613061445510-e296bfedb73e', // Kilimanjaro from Amboseli (Sergey Pesterev)
    'machakos':    '1759767119537-3ea0e5ff75de', // Acacia on dry grassland (Luis Martinez), general Kenya
    'mombasa':     '1680346087980-1dbc57f7ba56', // Beach with palm trees, Mombasa (Abdullatif Mutisya)
    'kilifi':      '1554732257-a16cfdfec4b5',    // Sailboats on the coast (Ripe Studios)
    'kisumu':      '1751568928692-29cd75fe607f', // Boat at sunset, Dunga Beach, Lake Victoria (Brian Kungu)
    'nakuru':      '1710136678658-a12caee832a7', // Flamingos, Lake Nakuru (Brian Kungu)
    'uasin-gishu': '1614531341773-3bff8b7cb3fc', // Trees on open grassland (Thomas Bennie), general Kenya
    'nyeri':       '1740344109789-2287538ab274', // Mt Kenya from Lamuria (Tourite Safaris)
  },
};

window.nestkeyPhotoUrl = function (idOrUrl, w, h) {
  if (!idOrUrl) return '';
  if (/^(https?:)?\//.test(idOrUrl)) return idOrUrl;
  return 'https://images.unsplash.com/photo-' + idOrUrl +
    '?auto=format&fit=crop&q=70&w=' + (w || 800) + (h ? '&h=' + h : '');
};
