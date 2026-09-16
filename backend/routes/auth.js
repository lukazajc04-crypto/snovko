const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { AccessError, linkChildAccount } = require('../services/access');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['parent', 'child'];
const MIN_PASSWORD = 8;
// Primerjava s tem hashom, ko uporabnik ne obstaja, da odzivni čas ne izda, kateri e-maili so registrirani
const DUMMY_HASH = bcrypt.hashSync('snovko-dummy-password', 10);

const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const findById = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?');
const insertUser = db.prepare(
  'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'
);
// Brezplačni preizkusni krediti, dokler Stripe ni nastavljen — 20 generacij ali pregledov
const FREE_TRIAL_CREDITS = 40;
const grantTrialCredits = db.prepare('INSERT INTO credits (user_id, balance) VALUES (?, ?)');

function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

router.post('/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  const role = req.body?.role ?? 'parent';

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Vnesi veljaven e-mail naslov.' });
  }
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Geslo mora imeti vsaj ${MIN_PASSWORD} znakov.` });
  }
  if (!name) {
    return res.status(400).json({ error: 'Vnesi ime.' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Vloga mora biti "parent" ali "child".' });
  }
  if (findByEmail.get(email)) {
    return res.status(409).json({ error: 'Račun s tem e-mailom že obstaja.' });
  }

  const accessCode = role === 'child' ? String(req.body?.access_code || '').trim() : '';
  const passwordHash = await bcrypt.hash(password, 12);

  let user;
  try {
    // Račun in povezava z otrokom nastaneta skupaj: napačna koda ne pusti osirotelega računa
    user = db.transaction(() => {
      const { lastInsertRowid } = insertUser.run(email, passwordHash, name, role);
      if (role === 'parent') grantTrialCredits.run(lastInsertRowid, FREE_TRIAL_CREDITS);
      if (accessCode) linkChildAccount(Number(lastInsertRowid), accessCode);
      return findById.get(lastInsertRowid);
    })();
  } catch (err) {
    if (err instanceof AccessError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const user = findByEmail.get(email);
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !valid) {
    return res.status(401).json({ error: 'Napačen e-mail ali geslo.' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = findById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Uporabnik ne obstaja.' });
  res.json({ user });
});

module.exports = router;
