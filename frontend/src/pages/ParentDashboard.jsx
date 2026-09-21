import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import NoteCard from '../components/NoteCard';
import CreditRing from '../components/CreditRing';
import WeekChart from '../components/WeekChart';
import SubjectBars from '../components/SubjectBars';
import BadgeShelf from '../components/BadgeShelf';
import OnboardingTutorial from '../components/OnboardingTutorial';
import { formatDate } from '../constants';
import '../styles/parent.css';

const PLAN_NAMES = { basic: 'Basic', standard: 'Standard', family: 'Družina' };
const LOW_CREDITS = 10;
const ACTIVITY_TYPES = { gradivo: 'Novo gradivo', kviz: 'Kviz', pregled: 'Pregledan list' };
const TUTORIAL_KEY = 'snovko_parent_tutorial_done';

function dayLabel(n) {
  const mod = n % 100;
  if (mod === 1) return 'dan zapored';
  if (mod === 2) return 'dneva zapored';
  if (mod === 3 || mod === 4) return 'dni zapored';
  return 'dni zapored';
}

// Smer nosita puščica in besedilo, ne samo barva
function Trend({ delta, prevPercent }) {
  if (delta === null) {
    return (
      <p className="trend-row">
        <span className="trend-chip is-flat">brez primerjave</span>
        <span className="trend-base">prejšnji teden ni bilo kvizov</span>
      </p>
    );
  }

  const up = delta > 0;
  return (
    <p className="trend-row">
      {delta === 0 ? (
        <span className="trend-chip is-flat">enako</span>
      ) : (
        <span className={`trend-chip ${up ? 'is-up' : 'is-down'}`}>
          <span aria-hidden="true">{up ? '↑' : '↓'}</span>
          {up ? '+' : '−'}
          {Math.abs(delta)} o. t.
        </span>
      )}
      <span className="trend-base">prejšnji teden {prevPercent} %</span>
    </p>
  );
}

function ActivityList({ activity }) {
  if (activity.length === 0) {
    return <p className="hand-note">Tu se bo pokazalo vse, kar se otrok nauči v Snovku.</p>;
  }
  return (
    <ul className="activity-list">
      {activity.map(a => (
        <li key={`${a.type}-${a.generation_id ?? a.check_id}-${a.created_at}`}>
          <Link to={a.type === 'pregled' ? `/checks/${a.check_id}` : `/results/${a.generation_id}`} className="activity-item">
            <span className="activity-subject">{a.subject}</span>
            <span className="activity-main">
              <span className="activity-type">{ACTIVITY_TYPES[a.type]}</span>
              <span className="activity-title">{a.naslov}</span>
            </span>
            <span className="activity-score">
              {a.score !== null ? (
                <span className={`score-chip ${a.score === a.total ? 'is-full' : ''}`}>
                  {a.score}/{a.total}
                </span>
              ) : (
                <span className="score-empty">—</span>
              )}
            </span>
            <time className="activity-date" dateTime={a.created_at}>
              {formatDate(a.created_at, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ParentDashboard() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const childId = searchParams.get('child');
  const paymentOk = searchParams.get('placilo') === 'uspesno';

  const progressCardRef = useRef(null);
  const creditDialRef = useRef(null);
  const subscribeRef = useRef(null);

  useEffect(() => {
    api
      .get('/api/dashboard/parent', { params: childId ? { child_id: childId } : {} })
      .then(res => setData(res.data))
      .catch(err => setError(errorMessage(err, 'Pregleda ni bilo mogoče naložiti.')));
  }, [childId]);

  const hasChild = Boolean(data?.child);
  useEffect(() => {
    if (hasChild && localStorage.getItem(TUTORIAL_KEY) !== 'true') setShowTutorial(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChild]);

  function finishTutorial() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setShowTutorial(false);
  }

  if (error) {
    return (
      <main className="page">
        <p className="form-error">{error}</p>
      </main>
    );
  }
  if (!data) return <p className="page-loading">Nalagam pregled…</p>;

  const { credits, child, children } = data;
  const today = new Date().toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <main className="page parent-page">
      <header className="parent-header">
        <p className="kicker">{today} →</p>
        <h1>Zdravo, {data.parent.name}</h1>
        {paymentOk && <p className="hand-note payment-ok">Hvala! Naročnina je aktivna, krediti so pripisani.</p>}
      </header>

      {children.length > 1 && (
        <nav className="child-switch" aria-label="Izberi otroka">
          {children.map(c => (
            <Link key={c.id} to={`/dashboard?child=${c.id}`} className={`btn btn-small ${child?.id === c.id ? 'btn-primary' : ''}`}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="parent-grid">
        <div className="parent-main">
          {child ? (
            <NoteCard tilt={-0.6} className="progress-card" ref={progressCardRef}>
              <div className="note-head">
                <h2>Napredek: {child.name}</h2>
                <span className="note-counter">{child.grade}. razred</span>
              </div>

              <div className="progress-stats">
                <div className="stat">
                  <span className="stat-value">
                    {child.week_quiz_percent === null ? '—' : `${child.week_quiz_percent} %`}
                  </span>
                  <span className="stat-label">
                    pravilnih odgovorov{child.week_quizzes > 0 ? ` v ${child.week_quizzes} kvizih` : ''} v zadnjih 7 dneh
                  </span>
                  <Trend delta={child.quiz_percent_delta} prevPercent={child.prev_quiz_percent} />
                </div>
                <div className="stat">
                  <span className="stat-value">{child.streak}</span>
                  <span className="stat-label">{dayLabel(child.streak)}</span>
                  {child.streak === 0 && <span className="trend-base">zadnje dni brez aktivnosti</span>}
                </div>
                <div className="stat">
                  <span className="stat-label stat-label-top">Skupaj doslej</span>
                  <ul className="totals-list">
                    <li>
                      <span className="totals-value">{child.totals.gradiva}</span> gradiv
                    </li>
                    <li>
                      <span className="totals-value">{child.totals.kvizi}</span> kvizov
                    </li>
                    <li>
                      <span className="totals-value">{child.totals.pregledi}</span> pregledanih listov
                    </li>
                  </ul>
                </div>
              </div>

              <h3 className="chart-title">Obvladovanje po predmetih</h3>
              <SubjectBars subjects={child.subjects} />

              <div className="weak-block">
                <h3 className="chart-title">Najšibkejše teme</h3>
                {child.weakest.length === 0 ? (
                  <span className="stat-empty">
                    {child.week_quizzes > 0 ? 'Vse rešeno brez napak!' : 'Še ni rešenih kvizov.'}
                  </span>
                ) : (
                  <ol className="weak-list">
                    {child.weakest.map(w => (
                      <li key={w.id}>
                        <Link to={`/results/${w.id}`}>{w.naslov}</Link>
                        <span className="weak-meta">
                          {w.subject} · {w.percent} %
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <h3 className="chart-title">Aktivnost v zadnjih 7 dneh</h3>
              <WeekChart week={child.week} />

              {child.badges && (
                <>
                  <h3 className="chart-title">
                    Značke <span className="chart-title-meta">{child.badges.earned_count} od {child.badges.total}</span>
                  </h3>
                  <BadgeShelf badges={child.badges} compact />
                </>
              )}
            </NoteCard>
          ) : (
            <NoteCard tilt={-0.6}>
              <h2>Dodajte otroka</h2>
              <p className="prose">Vpišite ime in razred otroka, pa bo lahko začel nalagati snov.</p>
              <Link to="/onboarding" className="btn btn-primary">
                Dodaj otroka
              </Link>
            </NoteCard>
          )}
        </div>

        <aside className="parent-side">
          <NoteCard tilt={1} className="credits-card">
            <div className="note-head">
              <h2>Krediti</h2>
              <span className="note-counter">{credits.plan ? PLAN_NAMES[credits.plan] : 'brez paketa'}</span>
            </div>
            <div ref={creditDialRef} className="credit-dial-target">
              <CreditRing balance={credits.balance} max={credits.plan_credits} />
            </div>
            <p className="credits-meta">
              {Math.floor(credits.balance / 2)} gradiv še na voljo
              {credits.reset_date && (
                <>
                  <br />
                  obnova {new Date(credits.reset_date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })}
                </>
              )}
            </p>
            {credits.balance < LOW_CREDITS && (
              <p className="credits-warning" role="status">
                <span aria-hidden="true">!</span>
                {credits.plan ? 'Krediti bodo kmalu porabljeni.' : 'Izberite paket, da otrok lahko ustvarja gradiva.'}
              </p>
            )}
            <Link to="/subscription" className="btn btn-primary" ref={subscribeRef}>
              Upravljaj naročnino
            </Link>
          </NoteCard>

          {children.length > 0 && (
            <NoteCard tilt={-1} className="access-card">
              <h2>Dostop za otroka</h2>
              <ul className="access-list">
                {children.map(c => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    {c.linked ? (
                      <span className="access-linked">✓ povezan</span>
                    ) : (
                      <span className="access-pending">
                        koda <code>{c.access_code}</code>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {children.some(c => !c.linked) && (
                <p className="access-help">Otrok ob registraciji izbere »Sem učenec« in vpiše kodo.</p>
              )}
            </NoteCard>
          )}
        </aside>
      </div>

      {child && (
        <section className="activity-section" aria-labelledby="activity-title">
          <h2 id="activity-title">Zadnja aktivnost</h2>
          <ActivityList activity={child.activity} />
        </section>
      )}

      {showTutorial && (
        <OnboardingTutorial
          onDone={finishTutorial}
          steps={[
            {
              targetRef: progressCardRef,
              title: 'Napredek tvojega otroka',
              text: 'Tukaj vidiš napredek svojega otroka. Kateri predmeti gredo dobro, kje potrebuje pomoč.',
              buttonLabel: 'Naprej →',
            },
            {
              targetRef: creditDialRef,
              title: 'Krediti',
              text: 'Krediti se porabijo ko otrok generira gradivo. Dokupi jih kadarkoli ali počakaj na mesečno obnovo.',
              buttonLabel: 'Naprej →',
            },
            {
              targetRef: subscribeRef,
              title: 'Naročnina',
              text: 'Tukaj upravljaš naročnino in dobiš račune. Kadarkoli lahko nadgradiš ali prekličeš.',
              buttonLabel: 'Začnimo! ✓',
            },
          ]}
        />
      )}
    </main>
  );
}
