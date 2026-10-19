const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { canAccessChild } = require('../services/access');
const { subjectProgress } = require('../services/progress');
const { GenerationError } = require('../services/claude');
const { generateAnimation } = require('../services/animation');
const tts = require('../services/tts');

const router = express.Router();

// Posnetki glasu za animirane razlage: en MP3 na korak, ustvari se ob prvem predvajanju
const AUDIO_DIR = path.join(__dirname, '../uploads/audio');

// Ponudnika glasu vračata MP3, lokalni nadomestni strežnik za preizkus pa WAV; vrsto preberemo iz glave datoteke
function audioType(file) {
  const head = Buffer.alloc(4);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, head, 0, 4, 0);
  fs.closeSync(fd);
  return head.toString('latin1') === 'RIFF' ? 'audio/wav' : 'audio/mpeg';
}

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

const addVoiceChars = db.prepare('UPDATE animations SET voice_chars = voice_chars + ? WHERE generation_id = ?');

// Dvojni klik ali dva zavihka hkrati ne smeta dvakrat plačati iste animacije ali posnetka
const pendingAnimations = new Map();
const pendingAudio = new Map();

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
  if (cached) return res.json({ animation: JSON.parse(cached.content_json), voice: tts.isConfigured() });

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
    res.status(201).json({ animation: await pendingAnimations.get(generation.id), voice: tts.isConfigured() });
  } catch (err) {
    if (err instanceof GenerationError) return res.status(err.status).json({ error: err.message });
    console.error('Napaka pri animaciji:', err);
    res.status(500).json({ error: 'Animacije ni bilo mogoče pripraviti. Poskusi znova.' });
  }
});

// Glas za en korak (eno poved) prizora. Če glas ni nastavljen ali ponudnik ne odgovori, odjemalec
// razlago prebere z glasom naprave.
router.get('/:id/animation/audio/:scene/:step', requireAuth, async (req, res) => {
  const found = loadAccessible(req, res);
  if (!found) return;
  const { generation } = found;

  const sceneIndex = Number(req.params.scene);
  const stepIndex = Number(req.params.step);
  const cached = getAnimation.get(generation.id);
  const scene = cached && Number.isInteger(sceneIndex) && JSON.parse(cached.content_json).prizori[sceneIndex];
  const text = scene && Number.isInteger(stepIndex) && scene.koraki[stepIndex]?.govor;
  if (!text) return res.status(404).json({ error: 'Korak ne obstaja.' });
  if (!tts.isConfigured()) return res.status(503).json({ error: 'Glas ni nastavljen.' });

  const file = path.join(AUDIO_DIR, String(generation.id), `${sceneIndex}-${stepIndex}.mp3`);
  if (!fs.existsSync(file)) {
    if (!pendingAudio.has(file)) {
      const job = tts
        .synthesize(text)
        .then(({ audio, chars }) => {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, audio);
          addVoiceChars.run(chars, generation.id);
        })
        .finally(() => pendingAudio.delete(file));
      pendingAudio.set(file, job);
    }
    try {
      await pendingAudio.get(file);
    } catch (err) {
      console.error('Napaka pri glasu:', err.message);
      return res.status(503).json({ error: 'Glasu trenutno ni mogoče pripraviti.' });
    }
  }
  res.type(audioType(file)).sendFile(file);
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
