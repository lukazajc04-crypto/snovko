const Stripe = require('stripe');

const PLANS = {
  basic: { credits: 100, priceEnv: 'STRIPE_PRICE_BASIC' },
  standard: { credits: 500, priceEnv: 'STRIPE_PRICE_STANDARD' },
  family: { credits: 500, priceEnv: 'STRIPE_PRICE_FAMILY' },
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
