const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { canAccessChild } = require('../services/access');
const { subjectProgress } = require('../services/progress');

const router = express.Router();

const getGeneration = db.prepare('SELECT * FROM generations WHERE id = ?');
const getChild = db.prepare('SELECT * FROM children WHERE id = ?');
const insertQuizResult = db.prepare(
  'INSERT INTO quiz_results (generation_id, score, total) VALUES (?, ?, ?)'
);

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
  });
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
