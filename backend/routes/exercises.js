const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { GenerationError } = require('../services/claude');
const { generateExercises } = require('../services/exercises');
const { canAccessChild } = require('../services/access');

const router = express.Router();
const COST = 2;

const getGeneration = db.prepare('SELECT * FROM generations WHERE id = ?');
const getChild = db.prepare('SELECT * FROM children WHERE id = ?');
const getSheet = db.prepare('SELECT * FROM exercise_sheets WHERE id = ?');
const sheetsForGeneration = db.prepare(
  'SELECT id, created_at FROM exercise_sheets WHERE generation_id = ? ORDER BY id DESC'
);
const getBalance = db.prepare('SELECT balance FROM credits WHERE user_id = ?');
const deductCredits = db.prepare(
  'UPDATE credits SET balance = balance - ? WHERE user_id = ? AND balance >= ?'
);
const insertSheet = db.prepare(
  'INSERT INTO exercise_sheets (generation_id, child_id, content_json) VALUES (?, ?, ?)'
);

const chargeAndSave = db.transaction((parentId, generationId, childId, sheet) => {
  const { changes } = deductCredits.run(COST, parentId, COST);
  if (changes === 0) return null;
  return insertSheet.run(generationId, childId, JSON.stringify(sheet)).lastInsertRowid;
});

// Rešitve dobi samo starš — otrok naj list najprej reši
function publicSheet(sheet, content, isParent) {
  return {
    id: sheet.id,
    created_at: sheet.created_at,
    generation_id: sheet.generation_id,
    naslov: content.naslov,
    navodilo: content.navodilo,
    naloge: content.naloge.map(({ resitev, razlaga, ...task }) =>
      isParent ? { ...task, resitev, razlaga } : task
    ),
    resitve_vidne: isParent,
  };
}

router.post('/', requireAuth, async (req, res) => {
  const generation = getGeneration.get(Number(req.body?.generation_id));
  const child = generation && getChild.get(generation.child_id);
  if (!generation || !child || !canAccessChild(req.user, child)) {
    return res.status(404).json({ error: 'Gradivo ne obstaja.' });
  }

  const balance = getBalance.get(child.parent_id)?.balance ?? 0;
  if (balance < COST) {
    return res.status(402).json({
      error: `Za učni list potrebuješ ${COST} kredita, na voljo imaš ${balance}.`,
      code: 'NO_CREDITS',
    });
  }

  const material = JSON.parse(generation.content_json);
  let sheet;
  try {
    sheet = await generateExercises({ material, subject: generation.subject, grade: child.grade });
  } catch (err) {
    if (err instanceof GenerationError) return res.status(err.status).json({ error: err.message });
    console.error('Napaka pri sestavljanju učnega lista:', err);
    return res.status(500).json({ error: 'Učnega lista ni bilo mogoče sestaviti. Poskusi znova.' });
  }

  const id = chargeAndSave(child.parent_id, generation.id, child.id, sheet);
  if (!id) {
    return res.status(402).json({ error: 'Krediti so bili medtem porabljeni.', code: 'NO_CREDITS' });
  }

  res.status(201).json({ id });
});

router.get('/:id', requireAuth, (req, res) => {
  const sheet = getSheet.get(Number(req.params.id));
  const child = sheet && getChild.get(sheet.child_id);
  if (!sheet || !child || !canAccessChild(req.user, child)) {
    return res.status(404).json({ error: 'Učni list ne obstaja.' });
  }

  res.json({
    sheet: publicSheet(sheet, JSON.parse(sheet.content_json), req.user.role === 'parent'),
    child: { id: child.id, name: child.name, grade: child.grade },
  });
});

router.get('/', requireAuth, (req, res) => {
  const generation = getGeneration.get(Number(req.query.generation_id));
  const child = generation && getChild.get(generation.child_id);
  if (!generation || !child || !canAccessChild(req.user, child)) {
    return res.status(404).json({ error: 'Gradivo ne obstaja.' });
  }
  res.json({ sheets: sheetsForGeneration.all(generation.id) });
});

module.exports = router;
