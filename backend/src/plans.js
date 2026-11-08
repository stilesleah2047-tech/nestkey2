// Subscription plans. `maxListings` caps how many published listings a poster
// can have (null = unlimited). Every feature listed here is delivered by the app.
const PLANS = [
  {
    // Free for house hunters — no fee to search, view or contact anyone.
    id: 'hunter', name: 'House Hunter', audience: 'For house hunters',
    monthly: 0, annual: 0, maxListings: 0, free: true,
    features: [
      'Browse every listing — no finder\u2019s fee',
      'Call or WhatsApp owners directly',
      'Exact map locations & directions',
      'Room-by-room video showcases',
      'Save favourite listings',
      'Verify a title deed',
    ],
  },
  {
    id: 'starter', name: 'Starter', audience: 'For individual landlords',
    monthly: 1000, annual: 10000, maxListings: 5,
    features: [
      'Publish up to 5 active properties',
      'Agent / landlord dashboard',
      'Enquiries & leads inbox with WhatsApp',
      'Views analytics per listing',
      'Photos, videos & exact map pin',
      'Pay by M-Pesa or card',
    ],
  },
  {
    id: 'pro', name: 'Pro', audience: 'For growing portfolios',
    monthly: 2500, annual: 25000, maxListings: 20, popular: true,
    features: [
      'Publish up to 20 active properties',
      'Everything in Starter',
      'Featured placement — your listings show first',
      'Verified badge on your listings',
      'Video showcase included',
    ],
  },
  {
    id: 'agency', name: 'Agency', audience: 'For agents & agencies',
    monthly: 4500, annual: 45000, maxListings: null,
    features: [
      'Unlimited listings',
      'Everything in Pro',
      'Top-of-search featured placement',
      'Verified badge on every listing',
      'Priority support',
    ],
  },
];

function getPlan(id) { return PLANS.find((p) => p.id === id) || null; }

module.exports = { PLANS, getPlan };
