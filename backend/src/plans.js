// Subscription plans. `maxListings` caps how many published listings a poster
// can have (null = unlimited). Every feature listed here is delivered by the app.
const PLANS = [
  {
    id: 'hunter', name: 'Hunter Plus', audience: 'For house hunters',
    monthly: 299, annual: 2990, maxListings: 0,
    features: [
      'Save unlimited favourite listings',
      'Contact owners directly by phone & WhatsApp',
      'See exact map locations & get directions',
      'Watch room-by-room video showcases',
      'Priority email support',
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
