const db = require('../db/db');

// Upošteva samo zadnji poskus kviza za vsako gradivo, da ponavljanje odraža trenutno znanje
const latestResults = db.prepare(`
  SELECT g.id AS generation_id, g.subject, g.content_json ->> '$.naslov' AS naslov, q.score, q.total
  FROM generations g
  JOIN quiz_results q ON q.id = (
    SELECT id FROM quiz_results WHERE generation_id = g.id ORDER BY id DESC LIMIT 1
  )
  WHERE g.child_id = ?
`);

const WEEK_START = "datetime('now', 'localtime', 'start of day', '-6 days', 'utc')";
const PREV_WEEK_START = "datetime('now', 'localtime', 'start of day', '-13 days', 'utc')";

const weekGenerations = db.prepare(`
  SELECT date(created_at, 'localtime') AS day, COUNT(*) AS n
  FROM generations WHERE child_id = ? AND created_at >= ${WEEK_START}
  GROUP BY day
`);
const weekQuizzes = db.prepare(`
  SELECT date(q.created_at, 'localtime') AS day, COUNT(*) AS n, SUM(q.score) AS score, SUM(q.total) AS total
  FROM quiz_results q JOIN generations g ON g.id = q.generation_id
  WHERE g.child_id = ? AND q.created_at >= ${WEEK_START}
  GROUP BY day
`);
const weekChecks = db.prepare(`
  SELECT date(created_at, 'localtime') AS day, COUNT(*) AS n
  FROM worksheet_checks WHERE child_id = ? AND created_at >= ${WEEK_START}
  GROUP BY day
`);

const prevWeekQuizzes = db.prepare(`
  SELECT COUNT(*) AS n, SUM(q.score) AS score, SUM(q.total) AS total
  FROM quiz_results q JOIN generations g ON g.id = q.generation_id
  WHERE g.child_id = ? AND q.created_at >= ${PREV_WEEK_START} AND q.created_at < ${WEEK_START}
`);

const totals = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM generations WHERE child_id = :id) AS gradiva,
    (SELECT COUNT(*) FROM quiz_results q JOIN generations g ON g.id = q.generation_id
       WHERE g.child_id = :id) AS kvizi,
    (SELECT COUNT(*) FROM worksheet_checks WHERE child_id = :id) AS pregledi
`);

// Vsi dnevi z aktivnostjo, najnovejši najprej — za štetje niza zaporednih dni
const activeDays = db.prepare(`
  SELECT DISTINCT day FROM (
    SELECT date(created_at, 'localtime') AS day FROM generations WHERE child_id = :id
    UNION
    SELECT date(q.created_at, 'localtime') FROM quiz_results q
      JOIN generations g ON g.id = q.generation_id WHERE g.child_id = :id
    UNION
    SELECT date(created_at, 'localtime') FROM worksheet_checks WHERE child_id = :id
  )
  ORDER BY day DESC
  LIMIT 400
`);

const recentActivity = db.prepare(`
  SELECT * FROM (
    SELECT 'gradivo' AS type, g.id AS generation_id, NULL AS check_id, g.subject,
           g.content_json ->> '$.naslov' AS naslov, g.created_at, NULL AS score, NULL AS total, g.id * 3 AS sort_id
    FROM generations g WHERE g.child_id = ?
    UNION ALL
    SELECT 'kviz', g.id, NULL, g.subject, g.content_json ->> '$.naslov', q.created_at, q.score, q.total, q.id * 3 + 1
    FROM quiz_results q JOIN generations g ON g.id = q.generation_id WHERE g.child_id = ?
    UNION ALL
    SELECT 'pregled', NULL, w.id, w.subject, w.result_json ->> '$.naslov', w.created_at, w.correct, w.total, w.id * 3 + 2
    FROM worksheet_checks w WHERE w.child_id = ?
  )
  ORDER BY created_at DESC, sort_id DESC
  LIMIT ?
`);

const ratio = r => r.score / r.total;

function subjectProgress(childId, subject) {
  const results = latestResults.all(childId).filter(r => r.subject === subject);
  if (results.length === 0) return { subject, percent: null, quizzes: 0, weakest: null };

  const score = results.reduce((sum, r) => sum + r.score, 0);
  const total = results.reduce((sum, r) => sum + r.total, 0);
  const weakest = results.reduce((worst, r) => (ratio(r) < ratio(worst) ? r : worst));

  return {
    subject,
    percent: Math.round((score / total) * 100),
    quizzes: results.length,
    weakest: weakest.score < weakest.total ? { id: weakest.generation_id, naslov: weakest.naslov } : null,
  };
}

function localDay(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toLocaleDateString('sv-SE');
}

// Niz teče, dokler je otrok delal vsak dan zapored; današnji brezdelni dan ga še ne prekine
function currentStreak(childId) {
  const days = new Set(activeDays.all({ id: childId }).map(r => r.day));
  if (days.size === 0) return 0;

  let offset = days.has(localDay(0)) ? 0 : 1;
  if (!days.has(localDay(offset))) return 0;

  let streak = 0;
  while (days.has(localDay(offset))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

// Obvladovanje po predmetih, najšibkejši najprej — tam starš najprej pogleda
function subjectBreakdown(childId) {
  const bySubject = new Map();
  for (const r of latestResults.all(childId)) {
    const s = bySubject.get(r.subject) ?? { score: 0, total: 0, quizzes: 0 };
    bySubject.set(r.subject, { score: s.score + r.score, total: s.total + r.total, quizzes: s.quizzes + 1 });
  }
  return [...bySubject]
    .map(([subject, s]) => ({ subject, percent: Math.round((s.score / s.total) * 100), quizzes: s.quizzes }))
    .sort((a, b) => a.percent - b.percent || b.quizzes - a.quizzes);
}

function percentOf(score, total) {
  return total ? Math.round((score / total) * 100) : null;
}

function childOverview(childId) {
  const generationsByDay = new Map(weekGenerations.all(childId).map(r => [r.day, r.n]));
  const quizRows = weekQuizzes.all(childId);
  const quizzesByDay = new Map(quizRows.map(r => [r.day, r.n]));
  const checksByDay = new Map(weekChecks.all(childId).map(r => [r.day, r.n]));

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = localDay(6 - i);
    return {
      day,
      gradiva: generationsByDay.get(day) ?? 0,
      kvizi: quizzesByDay.get(day) ?? 0,
      pregledi: checksByDay.get(day) ?? 0,
    };
  });

  const weekScore = quizRows.reduce((sum, r) => sum + r.score, 0);
  const weekTotal = quizRows.reduce((sum, r) => sum + r.total, 0);
  const weekQuizCount = quizRows.reduce((sum, r) => sum + r.n, 0);

  const prev = prevWeekQuizzes.get(childId);
  const weekPercent = percentOf(weekScore, weekTotal);
  const prevPercent = percentOf(prev.score ?? 0, prev.total ?? 0);

  const weakest = latestResults
    .all(childId)
    .filter(r => r.score < r.total)
    .sort((a, b) => ratio(a) - ratio(b))
    .slice(0, 3)
    .map(r => ({ id: r.generation_id, naslov: r.naslov, subject: r.subject, percent: Math.round(ratio(r) * 100) }));

  return {
    week,
    week_quiz_percent: weekPercent,
    week_quizzes: weekQuizCount,
    prev_quiz_percent: prevPercent,
    prev_quizzes: prev.n ?? 0,
    // Razlika je smiselna le, če sta oba tedna imela kvize
    quiz_percent_delta: weekPercent !== null && prevPercent !== null ? weekPercent - prevPercent : null,
    streak: currentStreak(childId),
    subjects: subjectBreakdown(childId),
    totals: totals.get({ id: childId }),
    weakest,
    activity: recentActivity.all(childId, childId, childId, 12).map(({ sort_id, ...row }) => row),
  };
}

module.exports = { subjectProgress, childOverview, currentStreak, subjectBreakdown };
