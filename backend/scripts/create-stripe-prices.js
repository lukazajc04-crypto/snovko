// Ustvari 3 mesečne cene v Stripe računu (iz STRIPE_SECRET_KEY) in njihove ID-je zapiše v .env.
// Varno za večkratni zagon: obstoječe cene najde po lookup_key in jih ne podvoji.
const fs = require('fs');
const path = require('path');
const ENV_PATH = path.join(__dirname, '../../.env');
require('dotenv').config({ path: ENV_PATH, quiet: true });

const Stripe = require('stripe');

const PRICES = [
  { env: 'STRIPE_PRICE_BASIC', lookupKey: 'snovko_basic_monthly', name: 'Snovko Basic', amount: 990 },
  { env: 'STRIPE_PRICE_STANDARD', lookupKey: 'snovko_standard_monthly', name: 'Snovko Standard', amount: 1490 },
  { env: 'STRIPE_PRICE_FAMILY', lookupKey: 'snovko_family_monthly', name: 'Snovko Družina', amount: 1990 },
];

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Manjka STRIPE_SECRET_KEY v .env.');
    process.exit(1);
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const existing = await stripe.prices.list({ lookup_keys: PRICES.map(p => p.lookupKey), active: true });
  let env = fs.readFileSync(ENV_PATH, 'utf8');

  for (const p of PRICES) {
    let price = existing.data.find(e => e.lookup_key === p.lookupKey);
    if (price) {
      console.log(`${p.name}: že obstaja (${price.id})`);
    } else {
      price = await stripe.prices.create({
        currency: 'eur',
        unit_amount: p.amount,
        recurring: { interval: 'month' },
        lookup_key: p.lookupKey,
        product_data: { name: p.name },
      });
      console.log(`${p.name}: ustvarjena (${price.id}), ${(p.amount / 100).toFixed(2)} €/mesec`);
    }

    const line = `${p.env}=${price.id}`;
    env = new RegExp(`^${p.env}=.*$`, 'm').test(env)
      ? env.replace(new RegExp(`^${p.env}=.*$`, 'm'), line)
      : `${env.trimEnd()}\n${line}\n`;
  }

  fs.writeFileSync(ENV_PATH, env);
  console.log('ID-ji cen so zapisani v .env. Restartaj backend.');
}

main().catch(err => {
  console.error('Napaka:', err.message);
  process.exit(1);
});
