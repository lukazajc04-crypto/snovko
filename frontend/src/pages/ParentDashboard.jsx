import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import NoteCard from '../components/NoteCard';
import CreditRing from '../components/CreditRing';
import WeekChart from '../components/WeekChart';
import SubjectBars from '../components/SubjectBars';
import BadgeShelf, { BadgeIcon } from '../components/BadgeShelf';
import StreakDots, { isActiveDay } from '../components/StreakDots';
import ActivityTimeline from '../components/ActivityTimeline';
import OnboardingTutorial from '../components/OnboardingTutorial';
import { GENERATION_COST } from '../constants';
import '../styles/parent.css';

const PLAN_NAMES = { basic: 'Basic', standard: 'Standard', family: 'Družina' };
const LOW_CREDITS = 10;
const TUTORIAL_KEY = 'snovko_parent_tutorial_done';

// Zavihki so kot pregradni listi v registratorju; barva je samo okras, pomen nosi ime
const TABS = [
  {
    id: 'teden',
    label: 'Ta teden',
    color: 'var(--sticky-yellow)',
    icon: <path d="M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4" />,
  },
  {
    id: 'predmeti',
    label: 'Predmeti',
    color: 'var(--sticky-blue)',
    icon: <path d="M4 5.5c3-1.2 5.5-1 8 .6 2.5-1.6 5-1.8 8-.6v12c-3-1.2-5.5-1-8 .6-2.5-1.6-5-1.8-8-.6v-12ZM12 6.1v12" />,
  },
  {
    id: 'dnevnik',
    label: 'Dnevnik',
    color: 'var(--sticky-lilac)',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  {
    id: 'znacke',
    label: 'Značke',
    color: 'var(--sticky-green)',
    icon: <path d="m12 3.8 2.5 5.3 5.6.8-4 4.1.9 5.8-5-2.8-5 2.8.9-5.8-4-4.1 5.6-.8L12 3.8Z" />,
  },
  {
    id: 'krediti',
    label: 'Krediti',
    color: 'var(--sticky-peach)',
    icon: (
      <>
        <ellipse cx="12" cy="7" rx="7" ry="2.8" />
        <path d="M5 7v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V7M5 12v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5" />
      </>
    ),
  },
];
const tabColor = id => TABS.find(t => t.id === id).color;

// Slovenska števila: 1 gradivo, 2 gradivi, 3–4 gradiva, 5+ gradiv
function pluralForm(n, [one, two, few, many]) {
  const mod = n % 100;
  if (mod === 1) return one;
  if (mod === 2) return two;
  if (mod === 3 || mod === 4) return few;
  return many;
}
const plural = (n, forms) => `${n} ${pluralForm(n, forms)}`;

function joinList(parts) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} in ${parts.at(-1)}` : parts.join('');
}

const weekSum = (week, key) => week.reduce((sum, d) => sum + (d[key] ?? 0), 0);

// Brez spolnih glagolskih oblik (naredil/naredila), ker spola otroka ne poznamo
function weekStory(child) {
  const parts = [
    [weekSum(child.week, 'gradiva'), ['novo gradivo', 'novi gradivi', 'nova gradiva', 'novih gradiv']],
    [weekSum(child.week, 'kvizi'), ['rešen kviz', 'rešena kviza', 'rešene kvize', 'rešenih kvizov']],
    [weekSum(child.week, 'pregledi'), ['pregledan list', 'pregledana lista', 'pregledane liste', 'pregledanih listov']],
  ]
    .filter(([n]) => n > 0)
    .map(([n, forms]) => plural(n, forms));

  if (parts.length === 0) return 'Ta teden še ni bilo učenja v Snovku — morda je danes pravi dan za prvo snov.';
  return `Ta teden ima ${child.name} za sabo ${joinList(parts)}.`;
}

// Strežnik značko zapiše šele ob otrokovem obisku njegove strani; dosežen cilj tu že šteje kot prislužen,
// sicer bi polica kazala zaklenjeno značko s 5 / 5
function withReachedBadges(badges) {
  const list = badges.badges.map(b => ({ ...b, earned: b.earned || b.progress >= b.goal }));
  return { ...badges, badges: list, earned_count: list.filter(b => b.earned).length };
}

// Zaklenjena značka, ki ji otrok manjka najmanj
function nextBadge(badges) {
  const locked = badges.filter(b => !b.earned);
  if (locked.length === 0) return null;
  return locked.reduce((best, b) => (b.progress / b.goal > best.progress / best.goal ? b : best));
}

function TrendChip({ delta }) {
  if (delta === null) return null;
  if (delta === 0) return <span className="trend-chip is-flat">enako kot prejšnji teden</span>;

  const up = delta > 0;
  return (
    <span className={`trend-chip ${up ? 'is-up' : 'is-down'}`}>
      <span aria-hidden="true">
        {up ? '↑ +' : '↓ −'}
        {Math.abs(delta)} o. t.
      </span>
      <span className="visually-hidden">
        {Math.abs(delta)} odstotnih točk {up ? 'več' : 'manj'} kot prejšnji teden
      </span>
    </span>
  );
}

function CreditsCard({ credits }) {
  return (
    <NoteCard tilt={-0.8} className="credits-card">
      <div className="note-head">
        <h2>Krediti</h2>
        <span className="note-counter">{credits.plan ? PLAN_NAMES[credits.plan] : 'brez paketa'}</span>
      </div>
      <CreditRing balance={credits.balance} max={credits.plan_credits} />
      <p className="credits-meta">
        {plural(Math.floor(credits.balance / GENERATION_COST), [
          'enostransko gradivo',
          'enostranski gradivi',
          'enostranska gradiva',
          'enostranskih gradiv',
        ])}{' '}
        še na voljo
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
      <Link to="/subscription" className="btn btn-primary">
        Upravljaj naročnino
      </Link>
    </NoteCard>
  );
}

function WeekPanel({ child }) {
  const activeDays = child.week.filter(isActiveDay).length;

  return (
    <div className="panel-split">
      <div>
        <h3 className="panel-title">
          Dnevi z učenjem <span className="panel-title-meta">{activeDays} od 7</span>
        </h3>
        <StreakDots week={child.week} />

        <h3 className="panel-title panel-title-gap">Kaj je nastalo po dnevih</h3>
        <WeekChart week={child.week} />
      </div>

      <aside className="review-note" aria-labelledby="review-title">
        <h3 id="review-title">Za ponoviti</h3>
        {child.weakest.length === 0 ? (
          <p className="review-empty">
            {child.week_quizzes > 0 ? 'Vse rešeno brez napak!' : 'Še ni rešenih kvizov.'}
          </p>
        ) : (
          <>
            <ul className="review-list">
              {child.weakest.map(w => (
                <li key={w.id}>
                  <span className="review-box" aria-hidden="true" />
                  <Link to={`/results/${w.id}`}>{w.naslov}</Link>
                  <span className="review-meta">
                    {w.subject} · {w.percent} % v zadnjem kvizu
                  </span>
                </li>
              ))}
            </ul>
            <p className="review-tip">Namig: odprite prvo temo in z otrokom preletite kartončke — pet minut je dovolj.</p>
          </>
        )}
      </aside>
    </div>
  );
}

function SubjectsPanel({ child }) {
  const { subjects, totals } = child;
  // Predmeti pridejo razvrščeni od najšibkejšega do najmočnejšega
  const best = subjects.at(-1);
  const weakest = subjects[0];

  return (
    <>
      {best && (
        <div className="callouts">
          <p className="callout callout-good">
            <span className="callout-label">Najbolje gre</span>
            <span className="callout-subject">{best.subject}</span>
            <span className="callout-value">{best.percent} % pravilnih odgovorov</span>
          </p>
          {subjects.length > 1 && weakest.percent < best.percent && (
            <p className="callout callout-help">
              <span className="callout-label">Več pomoči potrebuje</span>
              <span className="callout-subject">{weakest.subject}</span>
              <span className="callout-value">{weakest.percent} % pravilnih odgovorov</span>
            </p>
          )}
        </div>
      )}

      <h3 className="panel-title">Obvladovanje po predmetih</h3>
      <SubjectBars subjects={subjects} />

      <h3 className="panel-title panel-title-gap">Skupaj doslej</h3>
      <ul className="tally">
        <li>
          <span className="tally-value">{totals.gradiva}</span>
          {pluralForm(totals.gradiva, ['gradivo', 'gradivi', 'gradiva', 'gradiv'])}
        </li>
        <li>
          <span className="tally-value">{totals.kvizi}</span>
          {pluralForm(totals.kvizi, ['rešen kviz', 'rešena kviza', 'rešeni kvizi', 'rešenih kvizov'])}
        </li>
        <li>
          <span className="tally-value">{totals.pregledi}</span>
          {pluralForm(totals.pregledi, ['pregledan list', 'pregledana lista', 'pregledani listi', 'pregledanih listov'])}
        </li>
      </ul>
    </>
  );
}

function BadgesPanel({ badges }) {
  const next = nextBadge(badges.badges);

  return (
    <>
      {next && (
        <div className="next-badge">
          <BadgeIcon glyph={next.glyph} />
          <div className="next-badge-body">
            <p className="next-badge-label">Naslednja značka</p>
            <p className="next-badge-name">
              {next.name} <span>— {next.hint.charAt(0).toLowerCase() + next.hint.slice(1)}</span>
            </p>
            <div
              className="next-badge-track"
              role="progressbar"
              aria-label={`Napredek do značke ${next.name}`}
              aria-valuemin={0}
              aria-valuemax={next.goal}
              aria-valuenow={next.progress}
            >
              <span style={{ width: `${(next.progress / next.goal) * 100}%` }} />
            </div>
          </div>
          <p className="next-badge-count">
            {next.progress} / {next.goal}
          </p>
        </div>
      )}
      <BadgeShelf badges={badges} />
    </>
  );
}

function CreditsPanel({ credits, childList }) {
  return (
    <div className="credits-panel">
      <CreditsCard credits={credits} />

      <NoteCard tilt={0.8} className="access-card">
        <h2>Dostop za otroka</h2>
        <ul className="access-list">
          {childList.map(c => (
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
        {childList.some(c => !c.linked) && (
          <p className="access-help">Otrok ob registraciji izbere »Sem učenec« in vpiše kodo.</p>
        )}
      </NoteCard>

      <aside className="cost-note" aria-labelledby="cost-title">
        <h3 id="cost-title">Koliko kreditov porabi?</h3>
        <ul className="cost-list">
          <li>
            <span>Gradivo iz ene strani (do 4000 znakov) ali fotografije</span>
            <strong>{GENERATION_COST}</strong>
          </li>
          <li>
            <span>Daljša snov, vsakih nadaljnjih 3000 znakov</span>
            <strong>+{GENERATION_COST}</strong>
          </li>
          <li>
            <span>Pregled rešenega lista</span>
            <strong>2</strong>
          </li>
          <li>
            <span>Učni list z nalogami</span>
            <strong>2</strong>
          </li>
        </ul>
      </aside>
    </div>
  );
}

export default function ParentDashboard() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const childId = searchParams.get('child');
  const paymentOk = searchParams.get('placilo') === 'uspesno';
  const [tab, setTab] = useState(paymentOk ? 'krediti' : 'teden');

  const stickyRowRef = useRef(null);
  const creditStickyRef = useRef(null);
  const creditsTabRef = useRef(null);
  const binderRef = useRef(null);
  const tabRefs = useRef({});

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

  // Listek odpre svoj zavihek; če je registrator pod pregibom (ozek zaslon), se pomakne do njega
  function openTab(id) {
    setTab(id);
    const binder = binderRef.current;
    if (binder && binder.getBoundingClientRect().top > window.innerHeight * 0.5) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      binder.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function handleTabKey(e) {
    const i = TABS.findIndex(t => t.id === tab);
    const target = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    const next = TABS[(target + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
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
  const badges = child ? withReachedBadges(child.badges) : null;

  const weekMaterials = child ? weekSum(child.week, 'gradiva') : 0;
  const stickies = child
    ? [
        {
          tab: 'predmeti',
          value: child.week_quiz_percent === null ? '—' : `${child.week_quiz_percent} %`,
          label:
            child.week_quiz_percent === null
              ? 'ta teden še brez kvizov'
              : `pravilnih odgovorov v ${plural(child.week_quizzes, ['kvizu', 'kvizih', 'kvizih', 'kvizih'])} ta teden`,
          foot: <TrendChip delta={child.quiz_percent_delta} />,
          tilt: -1.6,
        },
        {
          tab: 'teden',
          value: (
            <>
              {child.streak}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3.5c.6 3-1 4.2-2.6 5.8C7.5 11.1 6.5 12.7 6.5 15a5.5 5.5 0 0 0 11 0c0-2-1-3.6-2.3-5.2-.8 1-1.5 1.4-2.2 1.4.9-2.6.6-5.3-1-7.7Z" />
              </svg>
            </>
          ),
          label: `${pluralForm(child.streak, ['dan', 'dneva', 'dni', 'dni'])} zapored z učenjem`,
          tilt: 1.2,
        },
        {
          tab: 'dnevnik',
          value: weekMaterials,
          label: `${pluralForm(weekMaterials, ['novo gradivo', 'novi gradivi', 'nova gradiva', 'novih gradiv'])} ta teden`,
          tilt: -0.8,
        },
        {
          tab: 'krediti',
          value: credits.balance,
          label: `${pluralForm(credits.balance, ['kredit', 'kredita', 'krediti', 'kreditov'])} · ${
            credits.plan ? PLAN_NAMES[credits.plan] : 'brez paketa'
          }`,
          foot: credits.balance < LOW_CREDITS && (
            <span className="sticky-alert">{credits.plan ? 'kmalu porabljeni' : 'izberite paket'}</span>
          ),
          tilt: 1.8,
        },
      ]
    : [];

  return (
    <main className="page parent-page">
      <header className="parent-header">
        <p className="kicker">{today} →</p>
        <h1>
          Zdravo, <span className="hl">{data.parent.name}</span>
        </h1>
        {child && (
          <>
            <p className="child-tag">
              {child.name} · {child.grade}. razred
            </p>
            <p className="week-story">{weekStory(child)}</p>
          </>
        )}
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

      {child ? (
        <>
          <ul className="sticky-row" ref={stickyRowRef} aria-label={`Na kratko: ${child.name}`}>
            {stickies.map((s, i) => (
              <li key={s.tab}>
                <button
                  type="button"
                  ref={s.tab === 'krediti' ? creditStickyRef : undefined}
                  className="sticky"
                  style={{ '--sticky': tabColor(s.tab), '--tilt': `${s.tilt}deg`, '--i': i }}
                  onClick={() => openTab(s.tab)}
                >
                  <span className="sticky-value">{s.value}</span>
                  <span className="sticky-label">{s.label}</span>
                  <span className="sticky-foot">
                    {s.foot}
                    <span className="sticky-more" aria-hidden="true">
                      poglej →
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="binder" ref={binderRef}>
            <div className="binder-tabs" role="tablist" aria-label={`Pregled: ${child.name}`} onKeyDown={handleTabKey}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`zavihek-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="zavihek-vsebina"
                  tabIndex={tab === t.id ? 0 : -1}
                  ref={el => {
                    tabRefs.current[t.id] = el;
                    if (t.id === 'krediti') creditsTabRef.current = el;
                  }}
                  className={`binder-tab ${tab === t.id ? 'is-active' : ''}`}
                  style={{ '--tab': t.color }}
                  onClick={() => setTab(t.id)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {t.icon}
                  </svg>
                  {t.label}
                  {t.id === 'znacke' && (
                    <span className="binder-tab-count">
                      {badges.earned_count}/{badges.total}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <section
              className="binder-page"
              id="zavihek-vsebina"
              role="tabpanel"
              aria-labelledby={`zavihek-${tab}`}
              tabIndex={0}
              style={{ '--tab': tabColor(tab) }}
            >
              <div className="binder-body" key={tab}>
                {tab === 'teden' && <WeekPanel child={child} />}
                {tab === 'predmeti' && <SubjectsPanel child={child} />}
                {tab === 'dnevnik' && <ActivityTimeline activity={child.activity} />}
                {tab === 'znacke' && <BadgesPanel badges={badges} />}
                {tab === 'krediti' && <CreditsPanel credits={credits} childList={children} />}
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="parent-empty">
          <NoteCard tilt={-0.6} className="add-child-card">
            <h2>Dodajte otroka</h2>
            <p className="prose">Vpišite ime in razred otroka, pa bo lahko začel nalagati snov.</p>
            <Link to="/onboarding" className="btn btn-primary">
              Dodaj otroka
            </Link>
          </NoteCard>
          <CreditsCard credits={credits} />
        </div>
      )}

      {showTutorial && (
        <OnboardingTutorial
          onDone={finishTutorial}
          steps={[
            {
              targetRef: stickyRowRef,
              title: 'Napredek tvojega otroka',
              text: 'Tukaj na kratko vidiš, kako gre tvojemu otroku. Klikni listek in odpre se podroben pregled.',
              buttonLabel: 'Naprej →',
            },
            {
              targetRef: creditStickyRef,
              title: 'Krediti',
              text: 'Krediti se porabijo ko otrok generira gradivo. Dokupi jih kadarkoli ali počakaj na mesečno obnovo.',
              buttonLabel: 'Naprej →',
            },
            {
              targetRef: creditsTabRef,
              title: 'Naročnina',
              text: 'V zavihku Krediti upravljaš naročnino in dobiš račune. Kadarkoli lahko nadgradiš ali prekličeš.',
              buttonLabel: 'Začnimo! ✓',
            },
          ]}
        />
      )}
    </main>
  );
}
