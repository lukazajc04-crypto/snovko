const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { AccessError, linkChildAccount } = require('../services/access');
const mail = require('../services/mail');

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

const RESET_TTL_MINUTES = 60;
const insertReset = db.prepare(
  `INSERT INTO password_resets (user_id, token_hash, expires_at)
   VALUES (?, ?, datetime('now', '+${RESET_TTL_MINUTES} minutes'))`
);
const findReset = db.prepare(
  "SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')"
);
const markResetUsed = db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?");
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
// Starejše neizrabljene zahteve razveljavimo, da je hkrati veljavna največ ena povezava
const voidPreviousResets = db.prepare(
  "UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL"
);

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

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

// Odgovor je vedno enak, tudi če računa ni — sicer bi bil to seznam registriranih e-mailov
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const ok = { message: 'Če račun s tem e-mailom obstaja, smo poslali povezavo za ponastavitev.' };

  // Nastavitev pošte preverimo PRED iskanjem uporabnika: če bi odgovor bil odvisen
  // od obstoja računa, bi bil ta klic seznam registriranih e-mailov
  if (!mail.isConfigured()) {
    return res.status(503).json({
      error: 'Pošiljanje e-pošte še ni nastavljeno. Obrnite se na podporo.',
    });
  }

  const user = EMAIL_RE.test(email) ? findByEmail.get(email) : null;
  if (!user) return res.json(ok);

  const token = crypto.randomBytes(32).toString('hex');
  db.transaction(() => {
    voidPreviousResets.run(user.id);
    insertReset.run(user.id, hashToken(token));
  })();

  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
  try {
    await mail.send({
      to: user.email,
      ...mail.resetPasswordMail({ name: user.name, url: `${base}/ponastavi-geslo/${token}` }),
    });
  } catch (err) {
    console.error('Ponastavitvenega e-maila ni bilo mogoče poslati:', err);
    return res.status(502).json({ error: 'E-maila ni bilo mogoče poslati. Poskusite znova.' });
  }

  res.json(ok);
});

router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');

  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Geslo mora imeti vsaj ${MIN_PASSWORD} znakov.` });
  }

  const reset = token && findReset.get(hashToken(token));
  if (!reset) {
    return res.status(400).json({ error: 'Povezava je potekla ali je bila že uporabljena.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  db.transaction(() => {
    updatePassword.run(passwordHash, reset.user_id);
    markResetUsed.run(reset.id);
  })();

  const user = findById.get(reset.user_id);
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const current = String(req.body?.current_password || '');
  const next = String(req.body?.password || '');

  if (next.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Novo geslo mora imeti vsaj ${MIN_PASSWORD} znakov.` });
  }

  const user = findByEmail.get(findById.get(req.user.id).email);
  if (!(await bcrypt.compare(current, user.password_hash))) {
    return res.status(401).json({ error: 'Trenutno geslo ni pravilno.' });
  }

  updatePassword.run(await bcrypt.hash(next, 12), user.id);
  res.json({ message: 'Geslo je spremenjeno.' });
});

router.get('/me', requireAuth, (req, res) => {
  const user = findById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Uporabnik ne obstaja.' });
  res.json({ user });
});

module.exports = router;
