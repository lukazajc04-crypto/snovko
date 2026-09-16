import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import UploadZone from '../components/UploadZone';
import GeneratingNote from '../components/GeneratingNote';
import LinkChildForm from '../components/LinkChildForm';
import OnboardingTutorial from '../components/OnboardingTutorial';
import { GENERATION_COST, SUBJECTS, formatDate } from '../constants';
import { useAuth } from '../context/AuthContext';
import '../styles/child.css';

const WORKSHEET_MESSAGES = ['Berem tvoje odgovore…', 'Preverjam rešitve…', 'Označujem list…', 'Še malo, natančno pregledujem…'];
const TUTORIAL_KEY = 'snovko_tutorial_done';

const MODES = [
  { id: 'material', label: 'Nova snov' },
  { id: 'worksheet', label: 'Preglej rešen list' },
];

function RecentList({ generations, checks }) {
  const items = [
    ...generations.map(g => ({ ...g, kind: 'material', to: `/results/${g.id}` })),
    ...checks.map(c => ({ ...c, kind: 'worksheet', to: `/checks/${c.id}` })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (items.length === 0) {
    return <p className="hand-note recent-empty">Tu se bodo pokazala tvoja gradiva in pregledani listi. Začni zgoraj!</p>;
  }

  return (
    <ul className="recent-list">
      {items.map(item => (
        <li key={`${item.kind}-${item.id}`}>
          <Link to={item.to} className="recent-item">
            <span className="recent-subject">{item.subject}</span>
            <span className="recent-title">
              {item.kind === 'worksheet' && <span className="recent-kind">pregledan list</span>}
              {item.naslov}
            </span>
            <span className="recent-meta">
              {item.kind === 'worksheet' ? (
                <span className="recent-score">
                  ✓ {item.correct}/{item.total}
                </span>
              ) : item.last_total ? (
                <span className="recent-score">
                  kviz {item.last_score}/{item.last_total}
                </span>
              ) : (
                <span className="recent-score is-open">kviz še čaka</span>
              )}
              <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ChildDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [needsLink, setNeedsLink] = useState(false);
  const [subject, setSubject] = useState(null);
  const [mode, setMode] = useState('material');
  const [working, setWorking] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [pulseUpload, setPulseUpload] = useState(false);
  const uploadBoxRef = useRef(null);
  const recentRef = useRef(null);
  const creditRef = useRef(null);

  useEffect(() => {
    if (data && localStorage.getItem(TUTORIAL_KEY) !== 'true') setShowTutorial(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(data)]);

  function finishTutorial() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setShowTutorial(false);
    setPulseUpload(true);
    setTimeout(() => setPulseUpload(false), 1300);
  }

  function load() {
    setLoadError('');
    api
      .get('/api/dashboard/child')
      .then(res => {
        setNeedsLink(false);
        setData(res.data);
      })
      .catch(err => {
        if (err.response?.data?.code === 'NO_CHILD') setNeedsLink(true);
        else setLoadError(errorMessage(err, 'Podatkov ni bilo mogoče naložiti.'));
      });
  }

  useEffect(load, []);

  const subjects = data?.child.subjects?.length ? data.child.subjects : SUBJECTS;
  const activeSubject = subjects.includes(subject) ? subject : subjects[0];

  async function handleSubmit({ file, text }) {
    setSubmitError('');
    setWorking(true);
    const body = new FormData();
    body.append('subject', activeSubject);
    if (file) body.append('file', file);
    else body.append('text', text);

    try {
      if (mode === 'worksheet') {
        const res = await api.post('/api/checks', body);
        navigate(`/checks/${res.data.id}`);
      } else {
        const res = await api.post('/api/generate', body);
        navigate(`/results/${res.data.id}`);
      }
    } catch (err) {
      const fallback = mode === 'worksheet' ? 'Lista ni bilo mogoče pregledati. Poskusi znova.' : 'Gradiva ni bilo mogoče ustvariti. Poskusi znova.';
      setSubmitError(errorMessage(err, fallback));
      if (err.response?.data?.code === 'NO_CREDITS') {
        setData(d => ({ ...d, credits: 0 }));
      }
      setWorking(false);
    }
  }

  const credits = data?.credits;
  const outOfCredits = credits !== undefined && credits < GENERATION_COST;

  return (
    <main className="page child-page">
      <header className="child-header">
        <h1>Zdravo, {data?.child.name ?? user.name}! Kaj se učiš danes?</h1>
        {credits !== undefined && (
          <p className="credit-counter" ref={creditRef} aria-label={`Na voljo imaš ${credits} kreditov`}>
            <span className="credit-number">{credits}</span> kreditov
          </p>
        )}
      </header>

      {loadError && <p className="form-error child-load-error">{loadError}</p>}
      {needsLink && <LinkChildForm onLinked={load} />}

      {data && (
        <>
          <div className="mode-switch" role="group" aria-label="Kaj želiš narediti">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                className={`btn ${mode === m.id ? 'btn-primary' : ''}`}
                aria-pressed={mode === m.id}
                onClick={() => {
                  setMode(m.id);
                  setSubmitError('');
                }}
                disabled={working}
              >
                {m.label}
              </button>
            ))}
          </div>

          <section className="upload-area" aria-label={mode === 'worksheet' ? 'Pregled rešenega lista' : 'Nova snov'}>
            <div className="paper-tabs" role="tablist" aria-label="Predmet">
              {subjects.map(name => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={activeSubject === name}
                  className={`paper-tab ${activeSubject === name ? 'is-active' : ''}`}
                  onClick={() => setSubject(name)}
                  disabled={working}
                >
                  {name}
                </button>
              ))}
            </div>

            <div ref={uploadBoxRef} className={pulseUpload ? 'upload-zone-pulse' : ''}>
              {working ? (
                <div className="upload-zone">
                  {mode === 'worksheet' ? <GeneratingNote messages={WORKSHEET_MESSAGES} interval={7000} /> : <GeneratingNote />}
                </div>
              ) : outOfCredits ? (
                <div className="upload-zone">
                  <p className="upload-title">Krediti so porabljeni</p>
                  <p className="hand-note">Povej staršem, da ti dokupijo kredite, pa lahko nadaljuješ.</p>
                </div>
              ) : (
                <UploadZone key={mode} variant={mode} onSubmit={handleSubmit} disabled={working} />
              )}
            </div>

            {submitError && (
              <p className="form-error" role="alert">
                {submitError}
              </p>
            )}
          </section>

          <section className="recent" ref={recentRef} aria-labelledby="recent-title">
            <h2 id="recent-title">Zadnje</h2>
            <RecentList generations={data.generations} checks={data.checks} />
          </section>
        </>
      )}

      {showTutorial && (
        <OnboardingTutorial
          onDone={finishTutorial}
          steps={[
            {
              targetRef: uploadBoxRef,
              title: 'Naloži svojo snov',
              text: 'Fotografiraj stran iz zvezka ali naloži PDF. AI bo prebral vse sam.',
              buttonLabel: 'Naprej →',
            },
            {
              targetRef: recentRef,
              title: 'Dobiš izpisek, kviz in kartončke',
              text: 'V manj kot minuti imaš vse pripravljeno za učenje.',
              buttonLabel: 'Naprej →',
            },
            {
              targetRef: creditRef,
              title: 'Tvoji krediti',
              text: 'Vsaka generacija porabi 2 kredita. Krediti se obnovijo vsak mesec.',
              buttonLabel: 'Začnimo! ✓',
            },
          ]}
        />
      )}
    </main>
  );
}
