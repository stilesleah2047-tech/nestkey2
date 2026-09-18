// Counties → towns/areas for the front-page search, post forms, and map plotting.
const COUNTY_CENTERS = {
  Nairobi: [-1.286, 36.817], Kiambu: [-1.171, 36.835], Kajiado: [-1.45, 36.90],
  Machakos: [-1.45, 37.00], Mombasa: [-4.043, 39.668], Kilifi: [-3.50, 39.90],
  Kisumu: [-0.0917, 34.768], Nakuru: [-0.303, 36.080], 'Uasin Gishu': [0.514, 35.269], Nyeri: [-0.417, 36.951],
};

const TOWN_COORDS = {
  // Nairobi
  Westlands: [-1.2649, 36.8039], Kilimani: [-1.2905, 36.7847], Kileleshwa: [-1.2799, 36.7820],
  Lavington: [-1.2790, 36.7660], Karen: [-1.3197, 36.7085], Langata: [-1.3600, 36.7300],
  Runda: [-1.2200, 36.8100], Muthaiga: [-1.2550, 36.8300], Parklands: [-1.2620, 36.8180],
  'South B': [-1.3080, 36.8360], 'South C': [-1.3200, 36.8300], 'Nairobi West': [-1.3150, 36.8250],
  CBD: [-1.2864, 36.8172], Kasarani: [-1.2210, 36.8980], Roysambu: [-1.2180, 36.8880],
  Embakasi: [-1.3230, 36.8940], Donholm: [-1.2930, 36.8880], Buruburu: [-1.2860, 36.8770],
  Umoja: [-1.2820, 36.8930], Utawala: [-1.2830, 36.9560], Ruai: [-1.2760, 36.9900],
  Ngara: [-1.2740, 36.8300], Dagoretti: [-1.2900, 36.7300], Kawangware: [-1.2860, 36.7460], Eastleigh: [-1.2740, 36.8480],
  // Kiambu
  Ruiru: [-1.1450, 36.9610], Thika: [-1.0333, 37.0693], Juja: [-1.1030, 37.0110], Kikuyu: [-1.2470, 36.6630],
  Limuru: [-1.1140, 36.6420], 'Kiambu Town': [-1.1710, 36.8350], Ruaka: [-1.2050, 36.7860],
  Kabete: [-1.2500, 36.7200], Githunguri: [-1.0570, 36.7660], Banana: [-1.2160, 36.7500],
  // Kajiado
  Kitengela: [-1.4700, 36.9600], Ngong: [-1.3530, 36.6550], 'Ongata Rongai': [-1.3970, 36.7450],
  Kiserian: [-1.4180, 36.6870], Isinya: [-1.6800, 36.8500], 'Kajiado Town': [-1.8520, 36.7760],
  // Machakos
  'Machakos Town': [-1.5177, 37.2634], 'Athi River': [-1.4560, 36.9780], Mlolongo: [-1.4020, 36.9350],
  Syokimau: [-1.3800, 36.9500], Mavoko: [-1.4400, 36.9900], Kangundo: [-1.3000, 37.3500],
  // Mombasa
  Nyali: [-4.0300, 39.7000], Bamburi: [-3.9900, 39.7200], Kizingo: [-4.0600, 39.6700], Tudor: [-4.0400, 39.6500],
  Likoni: [-4.0870, 39.6600], Bombolulu: [-4.0100, 39.6900], Shanzu: [-3.9600, 39.7400],
  // Kilifi
  Malindi: [-3.2180, 40.1170], 'Kilifi Town': [-3.6300, 39.8500], Mtwapa: [-3.9400, 39.7440], Watamu: [-3.3500, 40.0200],
  // Kisumu
  'Kisumu CBD': [-0.0917, 34.7680], Milimani: [-0.1000, 34.7550], Mamboleo: [-0.0500, 34.7800],
  Nyalenda: [-0.1200, 34.7600], Kondele: [-0.0800, 34.7700], Riat: [-0.0600, 34.7200],
  // Nakuru
  'Nakuru CBD': [-0.3031, 36.0800], 'Section 58': [-0.3050, 36.0900], Naivasha: [-0.7170, 36.4310],
  Lanet: [-0.3300, 36.1300], 'Free Area': [-0.2900, 36.0900],
  // Uasin Gishu
  'Eldoret CBD': [0.5143, 35.2698], Langas: [0.4900, 35.2600], Kapsoya: [0.5200, 35.3000],
  'Elgon View': [0.5100, 35.2800], Pioneer: [0.5000, 35.2900],
  // Nyeri
  'Nyeri Town': [-0.4170, 36.9510], Kiganjo: [-0.5000, 37.0000], Karatina: [-0.4830, 37.1300],
};

const TOWN_LISTS = {
  Nairobi: ['Westlands', 'Kilimani', 'Kileleshwa', 'Lavington', 'Karen', 'Langata', 'Runda', 'Muthaiga', 'Parklands', 'South B', 'South C', 'Nairobi West', 'Kasarani', 'Roysambu', 'Embakasi', 'Donholm', 'Buruburu', 'Umoja', 'Utawala', 'Ruai', 'CBD', 'Ngara', 'Dagoretti', 'Kawangware', 'Eastleigh'],
  Kiambu: ['Ruiru', 'Thika', 'Juja', 'Kikuyu', 'Limuru', 'Kiambu Town', 'Ruaka', 'Kabete', 'Githunguri', 'Banana'],
  Kajiado: ['Kitengela', 'Ngong', 'Ongata Rongai', 'Kiserian', 'Isinya', 'Kajiado Town'],
  Machakos: ['Machakos Town', 'Athi River', 'Mlolongo', 'Syokimau', 'Mavoko', 'Kangundo'],
  Mombasa: ['Nyali', 'Bamburi', 'Kizingo', 'Tudor', 'Likoni', 'Bombolulu', 'Shanzu'],
  Kilifi: ['Malindi', 'Kilifi Town', 'Mtwapa', 'Watamu'],
  Kisumu: ['Kisumu CBD', 'Milimani', 'Mamboleo', 'Nyalenda', 'Kondele', 'Riat'],
  Nakuru: ['Nakuru CBD', 'Milimani', 'Section 58', 'Naivasha', 'Lanet', 'Free Area'],
  'Uasin Gishu': ['Eldoret CBD', 'Langas', 'Kapsoya', 'Elgon View', 'Pioneer'],
  Nyeri: ['Nyeri Town', 'Kiganjo', 'Karatina'],
};

// Build the county objects (with center + per-town coords for the map).
const COUNTIES = Object.keys(TOWN_LISTS).map((county) => {
  const towns = TOWN_LISTS[county];
  const coords = {};
  towns.forEach((t) => { if (TOWN_COORDS[t]) coords[t] = TOWN_COORDS[t]; });
  return { county, center: COUNTY_CENTERS[county] || [-1.286, 36.817], towns, coords };
});

const TOWN_TO_COUNTY = {};
COUNTIES.forEach((c) => c.towns.forEach((t) => { TOWN_TO_COUNTY[t.toLowerCase()] = c.county; }));

function countyForTown(town) {
  return TOWN_TO_COUNTY[String(town || '').toLowerCase()] || '';
}

module.exports = { COUNTIES, countyForTown };
