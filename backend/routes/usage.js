const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const findEmail = db.prepare('SELECT email FROM users WHERE id = ?');

// Samo za lastnika: nastavi ADMIN_EMAIL v okolju. Brez nastavitve pot sploh ne obstaja.
function requireAdmin(req, res, next) {
  const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const email = findEmail.get(req.user.id)?.email?.toLowerCase();
  if (!admin || email !== admin) return res.status(404).json({ error: 'Pot ne obstaja' });
  next();
}

const bucket = db.prepare(`
  SELECT
    CASE WHEN source_chars = 0 THEN 'fotografija'
         WHEN source_chars <= 4000 THEN 'do 4000 znakov'
         WHEN source_chars <= 10000 THEN '4000-10000 znakov'
         ELSE 'nad 10000 znakov' END AS razred,
    COUNT(*)                          AS generacij,
    ROUND(AVG(cost_usd), 4)           AS povprecni_strosek_usd,
    ROUND(SUM(cost_usd), 4)           AS skupni_strosek_usd,
    ROUND(AVG(credits), 1)            AS povprecno_kreditov,
    ROUND(AVG(output_tokens))         AS povprecno_izhodnih_zetonov
  FROM api_usage
  GROUP BY razred
  ORDER BY MIN(source_chars)
`);
const totals = db.prepare(`
  SELECT COUNT(*) AS generacij, ROUND(COALESCE(SUM(cost_usd), 0), 4) AS skupni_strosek_usd,
         COALESCE(SUM(credits), 0) AS skupno_kreditov
  FROM api_usage
`);
const recent = db.prepare(
  'SELECT created_at, source_chars, calls, input_tokens, output_tokens, ROUND(cost_usd, 4) AS cost_usd, credits FROM api_usage ORDER BY id DESC LIMIT 20'
);

router.get('/', requireAuth, requireAdmin, (_req, res) => {
  res.json({ skupaj: totals.get(), po_dolzini: bucket.all(), zadnje: recent.all() });
});

module.exports = router;
