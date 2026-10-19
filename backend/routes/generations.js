const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { canAccessChild } = require('../services/access');
const { subjectProgress } = require('../services/progress');
const { GenerationError } = require('../services/claude');
const { generateAnimation } = require('../services/animation');

const router = express.Router();

const getGeneration = db.prepare('SELECT * FROM generations WHERE id = ?');
const getChild = db.prepare('SELECT * FROM children WHERE id = ?');
const insertQuizResult = db.prepare(
  'INSERT INTO quiz_results (generation_id, score, total) VALUES (?, ?, ?)'
);
const getAnimation = db.prepare('SELECT content_json FROM animations WHERE generation_id = ?');
const insertAnimation = db.prepare(`
  INSERT OR REPLACE INTO animations (generation_id, content_json, input_tokens, output_tokens, cost_usd)
  VALUES (?, ?, ?, ?, ?)
`);

// Dvojni klik ali dva zavihka hkrati ne smeta dvakrat plačati iste animacije
const pendingAnimations = new Map();

function loadAccessible(req, res) {
  const generation = getGeneration.get(Number(req.params.id));
  const child = generation && getChild.get(generation.child_id);
  if (!generation || !child || !canAccessChild(req.user, child)) {
    res.status(404).json({ error: 'Gradivo ne obstaja.' });
    return null;
  }
  return { generation, child };
}

router.get('/:id', requireAuth, (req, res) => {
  const found = loadAccessible(req, res);
  if (!found) return;
  const { generation, child } = found;

  res.json({
    id: generation.id,
    subject: generation.subject,
    created_at: generation.created_at,
    child: { id: child.id, name: child.name, grade: child.grade },
    content: JSON.parse(generation.content_json),
    progress: subjectProgress(child.id, generation.subject),
    has_animation: Boolean(getAnimation.get(generation.id)),
  });
});

// Animirana razlaga: ob prvem ogledu jo pripravi AI (~pol minute), nato se bere iz baze
router.post('/:id/animation', requireAuth, async (req, res) => {
  const found = loadAccessible(req, res);
  if (!found) return;
  const { generation, child } = found;

  const cached = getAnimation.get(generation.id);
  if (cached) return res.json({ animation: JSON.parse(cached.content_json) });

  if (!pendingAnimations.has(generation.id)) {
    const job = generateAnimation({
      material: JSON.parse(generation.content_json),
      subject: generation.subject,
      grade: child.grade,
    })
      .then(({ animation, usage }) => {
        insertAnimation.run(generation.id, JSON.stringify(animation), usage.inputTokens, usage.outputTokens, usage.costUsd);
        return animation;
      })
      .finally(() => pendingAnimations.delete(generation.id));
    pendingAnimations.set(generation.id, job);
  }

  try {
    res.status(201).json({ animation: await pendingAnimations.get(generation.id) });
  } catch (err) {
    if (err instanceof GenerationError) return res.status(err.status).json({ error: err.message });
    console.error('Napaka pri animaciji:', err);
    res.status(500).json({ error: 'Animacije ni bilo mogoče pripraviti. Poskusi znova.' });
  }
});

router.post('/:id/quiz-results', requireAuth, (req, res) => {
  const found = loadAccessible(req, res);
  if (!found) return;
  const { generation, child } = found;

  const score = Number(req.body?.score);
  const total = Number(req.body?.total);
  const questions = JSON.parse(generation.content_json).kviz.length;
  if (!Number.isInteger(total) || total !== questions || !Number.isInteger(score) || score < 0 || score > total) {
    return res.status(400).json({ error: 'Neveljaven rezultat kviza.' });
  }

  insertQuizResult.run(generation.id, score, total);
  res.status(201).json({ progress: subjectProgress(child.id, generation.subject) });
});

module.exports = router;
