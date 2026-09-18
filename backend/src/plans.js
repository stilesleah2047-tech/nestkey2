// Subscription plans. `maxListings` caps how many published listings a poster
// can have (null = unlimited). Consumer "hunter" plan doesn't post (maxListings 0).
const PLANS = [
  {
    id: 'hunter', name: 'Hunter Plus', audience: 'For house hunters',
    monthly: 299, annual: 2990, maxListings: 0,
    features: [
      'Instant alerts when a match is posted in your areas',
      'Early access to new listings before everyone else',
      'Unlimited saved searches & favourites',
      'See verified, scam-checked listings only',
      'Priority support',
    ],
  },
  {
    id: 'starter', name: 'Starter', audience: 'For individual landlords',
    monthly: 1000, annual: 10000, maxListings: 5,
    features: [
      'Publish up to 5 active properties',
      'Agent / landlord dashboard',
      'Enquiries & leads inbox',
      'Views analytics per listing',
      'Pay by M-Pesa or card',
    ],
  },
  {
    id: 'pro', name: 'Pro', audience: 'For growing portfolios',
    monthly: 2500, annual: 25000, maxListings: 20, popular: true,
    features: [
      'Publish up to 20 active properties',
      'Everything in Starter',
      'Featured placement on your listings',
      'Verified landlord badge',
      'WhatsApp lead forwarding',
    ],
  },
  {
    id: 'agency', name: 'Agency', audience: 'For agents & agencies',
    monthly: 4500, annual: 45000, maxListings: null,
    features: [
      'Unlimited listings',
      'Top-of-search priority placement',
      'Branded agency profile page',
      'Team member access',
      'Dedicated account support',
    ],
  },
];

function getPlan(id) { return PLANS.find((p) => p.id === id) || null; }

module.exports = { PLANS, getPlan };
