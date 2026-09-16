const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { PLANS, getStripe, priceIdForPlan, planForPriceId } = require('../services/stripe');

const router = express.Router();
const TRIAL_DAYS = 7;

const findUser = db.prepare('SELECT id, email, name, stripe_customer_id, subscription_id FROM users WHERE id = ?');
const findUserByCustomer = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?');
const setCustomer = db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?');
const setSubscription = db.prepare(
  'UPDATE users SET stripe_customer_id = ?, subscription_id = ? WHERE id = ?'
);
const clearSubscription = db.prepare(
  'UPDATE users SET subscription_id = NULL WHERE subscription_id = ? RETURNING id'
);
const upsertCredits = db.prepare(`
  INSERT INTO credits (user_id, balance, plan, reset_date) VALUES (@userId, @balance, @plan, @resetDate)
  ON CONFLICT(user_id) DO UPDATE SET balance = @balance, plan = @plan, reset_date = @resetDate
`);
const clearPlan = db.prepare('UPDATE credits SET plan = NULL, reset_date = NULL WHERE user_id = ?');

function stripeOr503(res) {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: 'Plačila trenutno niso na voljo (Stripe ni nastavljen).' });
  }
  return stripe;
}

const idOf = value => (typeof value === 'string' ? value : value?.id ?? null);

router.post('/create-subscription', requireAuth, requireRole('parent'), async (req, res) => {
  const plan = req.body?.plan;
  if (!PLANS[plan]) {
    return res.status(400).json({ error: 'Izberi paket: basic, standard ali family.' });
  }

  const stripe = stripeOr503(res);
  if (!stripe) return;

  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return res.status(503).json({ error: `Cena za paket "${plan}" ni nastavljena v .env.` });
  }

  const user = findUser.get(req.user.id);
  if (user.subscription_id) {
    return res.status(409).json({ error: 'Že imaš aktivno naročnino.' });
  }

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { user_id: String(user.id) },
    });
    customerId = customer.id;
    setCustomer.run(customerId, user.id);
  }

  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: String(user.id),
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { user_id: String(user.id), plan } },
    locale: 'sl',
    success_url: `${frontend}/dashboard?placilo=uspesno`,
    cancel_url: `${frontend}/subscription?placilo=preklicano`,
  });

  res.json({ url: session.url });
});

// Krediti se nastavijo ob invoice.paid (ne payment_intent.succeeded): račun nosi ID naročnine in ceno,
// in se sproži ob prvem plačilu ter ob vsaki mesečni obnovi.
function handleInvoicePaid(invoice) {
  const details = invoice.parent?.subscription_details;
  const subscriptionId = idOf(details?.subscription);
  if (!subscriptionId) return;

  const line = invoice.lines?.data?.find(l => l.pricing?.price_details?.price);
  const plan = planForPriceId(idOf(line?.pricing?.price_details?.price)) || details.metadata?.plan;
  if (!PLANS[plan]) {
    console.warn(`Stripe: neznan paket na računu ${invoice.id}`);
    return;
  }

  const customerId = idOf(invoice.customer);
  const userId = Number(details.metadata?.user_id) || findUserByCustomer.get(customerId)?.id;
  if (!userId || !findUser.get(userId)) {
    console.warn(`Stripe: uporabnik za račun ${invoice.id} ne obstaja`);
    return;
  }

  const periodEnd = line.period?.end;
  db.transaction(() => {
    setSubscription.run(customerId, subscriptionId, userId);
    upsertCredits.run({
      userId,
      balance: PLANS[plan].credits,
      plan,
      resetDate: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
  })();
}

function handleCheckoutCompleted(session) {
  if (session.mode !== 'subscription') return;
  const userId = Number(session.client_reference_id);
  if (!userId || !findUser.get(userId)) return;
  setSubscription.run(idOf(session.customer), idOf(session.subscription), userId);
}

function handleSubscriptionDeleted(subscription) {
  const cleared = clearSubscription.get(subscription.id);
  if (cleared) clearPlan.run(cleared.id);
}

router.post('/webhook', (req, res) => {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return res.status(503).json({ error: 'Stripe webhook ni nastavljen.' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
  } catch (err) {
    return res.status(400).json({ error: `Neveljaven podpis webhooka: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      handleCheckoutCompleted(event.data.object);
      break;
    case 'invoice.paid':
      handleInvoicePaid(event.data.object);
      break;
    case 'customer.subscription.deleted':
      handleSubscriptionDeleted(event.data.object);
      break;
  }

  res.json({ received: true });
});

module.exports = router;
