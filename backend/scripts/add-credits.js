// Za lokalno testiranje brez Stripe: node scripts/add-credits.js starš@email.si 100 [basic|standard|family]
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const db = require('../db/db');

const [email, amountArg, plan = 'basic'] = process.argv.slice(2);
const amount = Number(amountArg);

if (!email || !Number.isInteger(amount) || amount < 0) {
  console.error('Uporaba: node scripts/add-credits.js <email starša> <število kreditov> [basic|standard|family]');
  process.exit(1);
}

const user = db.prepare("SELECT id, name FROM users WHERE email = ? AND role = 'parent'").get(email.toLowerCase());
if (!user) {
  console.error(`Starš z e-mailom ${email} ne obstaja.`);
  process.exit(1);
}

db.prepare(`
  INSERT INTO credits (user_id, balance, plan) VALUES (?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET balance = excluded.balance, plan = excluded.plan
`).run(user.id, amount, plan);

console.log(`${user.name} (${email}): ${amount} kreditov, paket ${plan}.`);
