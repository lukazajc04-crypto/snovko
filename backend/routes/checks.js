const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { GenerationError } = require('../services/claude');
const { checkWorksheet } = require('../services/worksheet');
const { findChildForUser, canAccessChild, childNotFoundMessage } = require('../services/access');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const COST = 2;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const UPLOAD_DIR = path.join(__dirname, '../uploads/checks');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const getBalance = db.prepare('SELECT balance FROM credits WHERE user_id = ?');
const deductCredits = db.prepare('UPDATE credits SET balance = balance - ? WHERE user_id = ? AND balance >= ?');
const insertCheck = db.prepare(`
  INSERT INTO worksheet_checks (child_id, subject, image_file, result_json, correct, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const getCheck = db.prepare('SELECT * FROM worksheet_checks WHERE id = ?');
const getChild = db.prepare('SELECT * FROM children WHERE id = ?');

const chargeAndSave = db.transaction((parentId, row) => {
  const { changes } = deductCredits.run(COST, parentId, COST);
  if (changes === 0) return null;
  return insertCheck.run(row.childId, row.subject, row.imageFile, row.resultJson, row.correct, row.total).lastInsertRowid;
});

function notEnoughCredits(res, balance) {
  return res.status(402).json({
    error: `Za pregled potrebuješ ${COST} kredita, na voljo imaš ${balance}.`,
    code: 'NO_CREDITS',
  });
}

function loadAccessible(req, res) {
  const check = getCheck.get(Number(req.params.id));
  const child = check && getChild.get(check.child_id);
  if (!check || !child || !canAccessChild(req.user, child)) {
    res.status(404).json({ error: 'Pregled ne obstaja.' });
    return null;
  }
  return { check, child };
}

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const subject = String(req.body?.subject || '').trim();
  if (!subject) return res.status(400).json({ error: 'Izberi predmet.' });

  const child = findChildForUser(req.user, req.body?.child_id);
  if (!child) return res.status(404).json({ error: childNotFoundMessage(req.user) });

  const ext = path.extname(req.file?.originalname || '').toLowerCase();
  if (!req.file || !IMAGE_TYPES[ext]) {
    return res.status(400).json({ error: 'Naloži fotografijo rešenega lista (JPG ali PNG).' });
  }
  if (req.file.size > MAX_IMAGE_BYTES) {
    return res.status(400).json({ error: 'Fotografija je prevelika (največ 5 MB).' });
  }

  const balance = getBalance.get(child.parent_id)?.balance ?? 0;
  if (balance < COST) return notEnoughCredits(res, balance);

  let result;
  try {
    result = await checkWorksheet({
      image: { media_type: IMAGE_TYPES[ext], data: req.file.buffer.toString('base64') },
      subject,
      grade: child.grade,
    });
  } catch (err) {
    if (err instanceof GenerationError) return res.status(err.status).json({ error: err.message });
    console.error('Napaka pri pregledu lista:', err);
    return res.status(500).json({ error: 'Pri pregledu je prišlo do napake. Poskusi znova.' });
  }

  if (result.naloge.length === 0) {
    return res.status(422).json({ error: result.povzetek || 'Na fotografiji ni bilo mogoče najti nalog.' });
  }

  const imageFile = `${crypto.randomUUID()}${ext === '.png' ? '.png' : '.jpg'}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, imageFile), req.file.buffer);

  const checkId = chargeAndSave(child.parent_id, {
    childId: child.id,
    subject,
    imageFile,
    resultJson: JSON.stringify(result),
    correct: result.naloge.filter(n => n.status === 'pravilno').length,
    total: result.naloge.length,
  });
  if (checkId === null) {
    fs.rmSync(path.join(UPLOAD_DIR, imageFile), { force: true });
    return notEnoughCredits(res, getBalance.get(child.parent_id)?.balance ?? 0);
  }

  res.status(201).json({ id: checkId, credits: getBalance.get(child.parent_id).balance });
});

router.get('/:id', requireAuth, (req, res) => {
  const found = loadAccessible(req, res);
  if (!found) return;
  const { check, child } = found;

  res.json({
    id: check.id,
    subject: check.subject,
    created_at: check.created_at,
    correct: check.correct,
    total: check.total,
    child: { id: child.id, name: child.name, grade: child.grade },
    result: JSON.parse(check.result_json),
  });
});

router.get('/:id/image', requireAuth, (req, res) => {
  const found = loadAccessible(req, res);
  if (!found) return;
  res.sendFile(path.join(UPLOAD_DIR, path.basename(found.check.image_file)));
});

module.exports = router;
