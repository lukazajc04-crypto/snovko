const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { PLANS } = require('../services/stripe');
const { childOverview } = require('../services/progress');
const { findChildForUser, childNotFoundMessage, publicChild } = require('../services/access');

const router = express.Router();

const getCredits = db.prepare('SELECT balance, plan, reset_date FROM credits WHERE user_id = ?');
const getUser = db.prepare('SELECT name, subscription_id FROM users WHERE id = ?');
const listChildren = db.prepare('SELECT * FROM children WHERE parent_id = ? ORDER BY id');

const recentGenerations = db.prepare(`
  SELECT g.id, g.subject, g.created_at,
         g.content_json ->> '$.naslov' AS naslov,
         g.content_json ->> '$.kicker' AS kicker,
         (SELECT score FROM quiz_results WHERE generation_id = g.id ORDER BY id DESC LIMIT 1) AS last_score,
         (SELECT total FROM quiz_results WHERE generation_id = g.id ORDER BY id DESC LIMIT 1) AS last_total
  FROM generations g
  WHERE g.child_id = ?
  ORDER BY g.created_at DESC, g.id DESC
  LIMIT 30
`);

const recentChecks = db.prepare(`
  SELECT id, subject, created_at, result_json ->> '$.naslov' AS naslov, correct, total
  FROM worksheet_checks
  WHERE child_id = ?
  ORDER BY created_at DESC, id DESC
  LIMIT 30
`);

router.get('/child', requireAuth, (req, res) => {
  const child = findChildForUser(req.user, req.query.child_id);
  if (!child) return res.status(404).json({ error: childNotFoundMessage(req.user), code: 'NO_CHILD' });

  res.json({
    child: publicChild(child),
    credits: getCredits.get(child.parent_id)?.balance ?? 0,
    generations: recentGenerations.all(child.id),
    checks: recentChecks.all(child.id),
  });
});

router.get('/parent', requireAuth, requireRole('parent'), (req, res) => {
  const user = getUser.get(req.user.id);
  const credits = getCredits.get(req.user.id);
  const children = listChildren.all(req.user.id);
  const selected = findChildForUser(req.user, req.query.child_id);

  res.json({
    parent: { name: user.name },
    credits: {
      balance: credits?.balance ?? 0,
      plan: credits?.plan ?? null,
      plan_credits: PLANS[credits?.plan]?.credits ?? null,
      reset_date: credits?.reset_date ?? null,
      subscribed: Boolean(user.subscription_id),
    },
    children: children.map(c => ({ ...publicChild(c), access_code: c.access_code, linked: c.user_id !== null })),
    child: selected ? { id: selected.id, name: selected.name, grade: selected.grade, ...childOverview(selected.id) } : null,
  });
});

module.exports = router;
