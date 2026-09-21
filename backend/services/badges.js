const db = require('../db/db');
const { currentStreak, subjectBreakdown } = require('./progress');

const MASTERY_PERCENT = 90;
const MASTERY_MIN_QUIZZES = 3;

// value(stats) vrne napredek proti goal; značka je prislužena, ko ga doseže
const CATALOG = [
  { code: 'prvi_korak', name: 'Prvi korak', hint: 'Naloži prvo snov', glyph: 'book', goal: 1, value: s => s.gradiva },
  { code: 'gradiv_10', name: 'Deset razlag', hint: 'Naloži 10 gradiv', glyph: 'book', goal: 10, value: s => s.gradiva },
  { code: 'gradiv_25', name: 'Polna beležka', hint: 'Naloži 25 gradiv', glyph: 'book', goal: 25, value: s => s.gradiva },
  { code: 'niz_3', name: 'Trije zapored', hint: 'Uči se 3 dni zapored', glyph: 'flame', goal: 3, value: s => s.streak },
  { code: 'niz_7', name: 'Cel teden', hint: 'Uči se 7 dni zapored', glyph: 'flame', goal: 7, value: s => s.streak },
  { code: 'niz_30', name: 'Mesec dni', hint: 'Uči se 30 dni zapored', glyph: 'flame', goal: 30, value: s => s.streak },
  { code: 'brez_napake', name: 'Brez napake', hint: 'Reši kviz brez ene same napake', glyph: 'star', goal: 1, value: s => s.popolni },
  { code: 'peterica', name: 'Peterica', hint: 'Reši 5 kvizov brez napake', glyph: 'star', goal: 5, value: s => s.popolni },
  {
    code: 'mojster',
    name: 'Mojster predmeta',
    hint: `${MASTERY_PERCENT} % pri enem predmetu (vsaj ${MASTERY_MIN_QUIZZES} kvizi)`,
    glyph: 'rosette',
    goal: MASTERY_PERCENT,
    value: s => s.najboljsiPredmet,
  },
  { code: 'radovednez', name: 'Radovednež', hint: 'Uči se pri 5 različnih predmetih', glyph: 'compass', goal: 5, value: s => s.predmeti },
  { code: 'popravljalec', name: 'Popravljalec', hint: 'Daj v pregled prvi rešen list', glyph: 'check', goal: 1, value: s => s.listi },
];

const countStats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM generations WHERE child_id = :id) AS gradiva,
    (SELECT COUNT(DISTINCT subject) FROM generations WHERE child_id = :id) AS predmeti,
    (SELECT COUNT(*) FROM worksheet_checks WHERE child_id = :id) AS listi,
    (SELECT COUNT(*) FROM quiz_results q JOIN generations g ON g.id = q.generation_id
       WHERE g.child_id = :id AND q.score = q.total) AS popolni
`);

const listEarned = db.prepare('SELECT code, earned_at FROM badges WHERE child_id = ?');
const grantBadge = db.prepare('INSERT OR IGNORE INTO badges (child_id, code) VALUES (?, ?)');

function gatherStats(childId) {
  const counts = countStats.get({ id: childId });
  const mastered = subjectBreakdown(childId).filter(s => s.quizzes >= MASTERY_MIN_QUIZZES);

  return {
    ...counts,
    streak: currentStreak(childId),
    najboljsiPredmet: mastered.length ? Math.max(...mastered.map(s => s.percent)) : 0,
  };
}

function describe(childId) {
  const stats = gatherStats(childId);
  const earned = new Map(listEarned.all(childId).map(r => [r.code, r.earned_at]));

  const badges = CATALOG.map(b => ({
    code: b.code,
    name: b.name,
    hint: b.hint,
    glyph: b.glyph,
    goal: b.goal,
    // Napredek zamrzne na cilju, da prislužena značka ne kaže 12/10
    progress: Math.min(b.value(stats), b.goal),
    earned: earned.has(b.code),
    earned_at: earned.get(b.code) ?? null,
  }));

  return { badges, earned_count: badges.filter(b => b.earned).length, total: CATALOG.length };
}

// Otrokov pregled: zapiše na novo prislužene značke. Katere so "sveže", presodi
// odjemalec iz earned_at — enkratna zastavica bi zgorela ob osvežitvi strani.
function syncBadges(childId) {
  const stats = gatherStats(childId);
  for (const b of CATALOG) {
    if (b.value(stats) >= b.goal) grantBadge.run(childId, b.code);
  }
  return describe(childId);
}

function listBadges(childId) {
  return describe(childId);
}

module.exports = { syncBadges, listBadges };
