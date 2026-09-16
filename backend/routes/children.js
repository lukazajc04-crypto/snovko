const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { SUBJECTS } = require('../services/subjects');
const { AccessError, generateAccessCode, linkChildAccount, publicChild } = require('../services/access');

const router = express.Router();

const MAX_CHILDREN = { family: 3 };

const listChildren = db.prepare('SELECT * FROM children WHERE parent_id = ? ORDER BY id');
const countChildren = db.prepare('SELECT COUNT(*) AS n FROM children WHERE parent_id = ?');
const getPlan = db.prepare('SELECT plan FROM credits WHERE user_id = ?');
const insertChild = db.prepare(
  'INSERT INTO children (parent_id, name, grade, subjects, access_code) VALUES (?, ?, ?, ?, ?)'
);
const getChild = db.prepare('SELECT * FROM children WHERE id = ?');

const forParent = child => ({ ...publicChild(child), access_code: child.access_code, linked: child.user_id !== null });

router.get('/', requireAuth, requireRole('parent'), (req, res) => {
  res.json({ children: listChildren.all(req.user.id).map(forParent) });
});

router.post('/', requireAuth, requireRole('parent'), (req, res) => {
  const name = String(req.body?.name || '').trim();
  const grade = Number(req.body?.grade);
  const subjects = Array.isArray(req.body?.subjects) ? [...new Set(req.body.subjects)] : [];

  if (!name || name.length > 40) {
    return res.status(400).json({ error: 'Vnesi ime otroka.' });
  }
  if (!Number.isInteger(grade) || grade < 1 || grade > 9) {
    return res.status(400).json({ error: 'Izberi razred od 1 do 9.' });
  }
  if (subjects.some(s => !SUBJECTS.includes(s))) {
    return res.status(400).json({ error: 'Neznan predmet.' });
  }

  const plan = getPlan.get(req.user.id)?.plan;
  const limit = MAX_CHILDREN[plan] ?? 1;
  if (countChildren.get(req.user.id).n >= limit) {
    return res.status(403).json({
      error: plan === 'family' ? 'Paket Družina omogoča do 3 otroke.' : 'Za več otrok izberi paket Družina.',
    });
  }

  const { lastInsertRowid } = insertChild.run(req.user.id, name, grade, JSON.stringify(subjects), generateAccessCode());
  res.status(201).json({ child: forParent(getChild.get(lastInsertRowid)) });
});

router.post('/link', requireAuth, requireRole('child'), (req, res) => {
  try {
    const child = linkChildAccount(req.user.id, req.body?.code);
    res.json({ child: publicChild(child) });
  } catch (err) {
    if (err instanceof AccessError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

module.exports = router;
