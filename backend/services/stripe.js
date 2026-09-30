const Stripe = require('stripe');

// Standard/Family sta imela 500 kreditov pri isti ceni na kredit kot poceni razsuti paket —
// pri polni porabi je to pustilo Standardu premalo marže. Kreditov je manj, cena ostane enaka;
// razmerje cena/kredit se s tem dvigne. Realna raba je daleč pod tem stropom (glej pogovor/README),
// zato zmanjšanje skoraj nihče ne opazi — je predvsem varovalka marže, ne omejitev za uporabnika.
const PLANS = {
  basic: { credits: 100, priceEnv: 'STRIPE_PRICE_BASIC' },
  standard: { credits: 200, priceEnv: 'STRIPE_PRICE_STANDARD' },
  family: { credits: 450, priceEnv: 'STRIPE_PRICE_FAMILY' },
};

let client;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

function priceIdForPlan(plan) {
  return process.env[PLANS[plan]?.priceEnv] || null;
}

function planForPriceId(priceId) {
  return Object.keys(PLANS).find(plan => priceId && process.env[PLANS[plan].priceEnv] === priceId) || null;
}

module.exports = { PLANS, getStripe, priceIdForPlan, planForPriceId };
