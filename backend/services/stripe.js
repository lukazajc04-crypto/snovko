const Stripe = require('stripe');

// Standard/Family sta imela 500 kreditov pri isti ceni na kredit kot poceni razsuti paket —
// pri polni porabi (3 krediti/stran, dejanski strošek ~7,8 centa/stran) je to pustilo Standardu
// le ~3 % marže. Kreditov je manj, cena ostane enaka; razmerje cena/kredit se s tem dvigne.
const PLANS = {
  basic: { credits: 100, priceEnv: 'STRIPE_PRICE_BASIC' },
  standard: { credits: 300, priceEnv: 'STRIPE_PRICE_STANDARD' },
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
