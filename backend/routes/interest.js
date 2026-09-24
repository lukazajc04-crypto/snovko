const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const FEATURES = ['video'];

const record = db.prepare('INSERT OR IGNORE INTO feature_interest (user_id, feature) VALUES (?, ?)');
const countFor = db.prepare('SELECT COUNT(*) AS n FROM feature_interest WHERE feature = ?');
const mine = db.prepare('SELECT feature FROM feature_interest WHERE user_id = ?');

router.post('/', requireAuth, (req, res) => {
  const feature = String(req.body?.feature || '');
  if (!FEATURES.includes(feature)) {
    return res.status(400).json({ error: 'Neznana funkcija.' });
  }
  record.run(req.user.id, feature);
  res.status(201).json({ feature, skupaj: countFor.get(feature).n });
});

router.get('/', requireAuth, (req, res) => {
  res.json({ features: mine.all(req.user.id).map(r => r.feature) });
});

module.exports = router;
