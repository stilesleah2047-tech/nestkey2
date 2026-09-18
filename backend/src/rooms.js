// Canonical room/area order — a listing's rooms are auto-arranged into this
// sequence so every showcase reads like a proper walk-through of the home.
const ROOM_TYPES = [
  { key: 'exterior', label: 'Exterior / Front' },
  { key: 'living', label: 'Living Room' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'dining', label: 'Dining Area' },
  { key: 'bedroom', label: 'Bedroom' },
  { key: 'bathroom', label: 'Bathroom' },
  { key: 'balcony', label: 'Balcony / View' },
  { key: 'compound', label: 'Compound / Parking' },
  { key: 'other', label: 'Other' },
];

const ORDER = {};
ROOM_TYPES.forEach((t, i) => { ORDER[t.key] = i; });

function labelFor(key) {
  const t = ROOM_TYPES.find((x) => x.key === key);
  return t ? t.label : 'Other';
}

// Sort rooms into the canonical order; keep original order within the same type.
function sortRooms(rooms) {
  return (rooms || [])
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const oa = ORDER[a.r.type] != null ? ORDER[a.r.type] : 99;
      const ob = ORDER[b.r.type] != null ? ORDER[b.r.type] : 99;
      return oa - ob || a.i - b.i;
    })
    .map((x) => x.r);
}

module.exports = { ROOM_TYPES, labelFor, sortRooms };
