const express = require('express');
const multer = require('multer');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { generateMaterial, GenerationError } = require('../services/claude');
const { extractFromFile, ExtractError } = require('../services/extract');
const { findChildForUser, childNotFoundMessage } = require('../services/access');
const { creditsForText, creditsForImage } = require('../services/credits');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const MIN_TEXT = 30;
const MAX_TEXT = 40000;

const getBalance = db.prepare('SELECT balance FROM credits WHERE user_id = ?');
const deductCredits = db.prepare(
  'UPDATE credits SET balance = balance - ? WHERE user_id = ? AND balance >= ?'
);
const insertGeneration = db.prepare(
  'INSERT INTO generations (child_id, subject, content_json) VALUES (?, ?, ?)'
);
const findGeneration = db.prepare('SELECT id, created_at FROM generations WHERE id = ?');
const insertUsage = db.prepare(`
  INSERT INTO api_usage (generation_id, source_chars, calls, input_tokens, output_tokens, cost_usd, credits)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const chargeAndSave = db.transaction((parentId, childId, subject, material, cost, usage, sourceChars) => {
  const { changes } = deductCredits.run(cost, parentId, cost);
  if (changes === 0) return null;
  const { lastInsertRowid } = insertGeneration.run(childId, subject, JSON.stringify(material));
  insertUsage.run(lastInsertRowid, sourceChars, usage.calls, usage.inputTokens, usage.outputTokens, usage.costUsd, cost);
  return lastInsertRowid;
});

function notEnoughCredits(res, balance, cost) {
  return res.status(402).json({
    error:
      cost > 2
        ? `Ta snov je daljša, zato porabi ${cost} kreditov (2 kredita na stran), na voljo imaš ${balance}.`
        : `Za generiranje potrebuješ ${cost} kredita, na voljo imaš ${balance}.`,
    code: 'NO_CREDITS',
    needed: cost,
  });
}

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const subject = String(req.body?.subject || '').trim();
  if (!subject) {
    return res.status(400).json({ error: 'Izberi predmet.' });
  }

  const child = findChildForUser(req.user, req.body?.child_id);
  if (!child) {
    return res.status(404).json({ error: childNotFoundMessage(req.user) });
  }

  let source;
  try {
    source = req.file ? await extractFromFile(req.file) : { text: String(req.body?.text || '') };
  } catch (err) {
    if (err instanceof ExtractError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  if (!source.image) {
    source.text = source.text.trim();
    if (source.text.length < MIN_TEXT) {
      return res.status(400).json({
        error: req.file
          ? 'V datoteki ni dovolj besedila. Poskusi s fotografijo strani.'
          : `Snov mora imeti vsaj ${MIN_TEXT} znakov.`,
      });
    }
    if (source.text.length > MAX_TEXT) {
      return res.status(400).json({
        error: `Snov je predolga (${source.text.length} znakov, največ ${MAX_TEXT}). Razdeli jo na manjše dele.`,
      });
    }
  }

  const sourceChars = source.image ? 0 : source.text.length;
  const cost = source.image ? creditsForImage() : creditsForText(sourceChars);
  const balance = getBalance.get(child.parent_id)?.balance ?? 0;
  if (balance < cost) return notEnoughCredits(res, balance, cost);

  let material;
  let usage;
  try {
    ({ material, usage } = await generateMaterial({ ...source, subject, grade: child.grade }));
  } catch (err) {
    if (err instanceof GenerationError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Napaka pri generiranju:', err);
    return res.status(500).json({ error: 'Pri generiranju je prišlo do napake. Poskusi znova.' });
  }

  // Krediti se odštejejo šele po uspešni generaciji; ponovno preverjanje ujame sočasne zahteve
  const generationId = chargeAndSave(child.parent_id, child.id, subject, material, cost, usage, sourceChars);
  if (generationId === null) {
    return notEnoughCredits(res, getBalance.get(child.parent_id)?.balance ?? 0, cost);
  }

  const saved = findGeneration.get(generationId);
  res.status(201).json({
    id: saved.id,
    child_id: child.id,
    subject,
    created_at: saved.created_at,
    credits: getBalance.get(child.parent_id).balance,
    cost,
    content: material,
  });
});

module.exports = router;
