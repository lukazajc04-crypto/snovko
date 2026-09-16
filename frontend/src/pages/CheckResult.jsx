import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import NoteCard from '../components/NoteCard';
import { formatDate } from '../constants';
import { useAuth } from '../context/AuthContext';
import '../styles/checks.css';

const STATUS = {
  pravilno: { symbol: '✓', label: 'pravilno', className: 'is-correct' },
  napacno: { symbol: '✗', label: 'napačno', className: 'is-wrong' },
  neodgovorjeno: { symbol: '✗', label: 'manjka odgovor', className: 'is-wrong' },
  neberljivo: { symbol: '?', label: 'ni čitljivo', className: 'is-unclear' },
};

function Mark({ task, index, active, onActivate }) {
  const status = STATUS[task.status];
  const showSolution = task.status === 'napacno' || task.status === 'neodgovorjeno';
  const labelSide = task.x > 780 ? 'left' : 'right';

  return (
    <button
      type="button"
      className={`sheet-mark ${status.className} ${active ? 'is-active' : ''}`}
      style={{ left: `${task.x / 10}%`, top: `${task.y / 10}%` }}
      onMouseEnter={() => onActivate(index)}
      onFocus={() => onActivate(index)}
      onClick={() => onActivate(index)}
      aria-label={`Naloga ${task.stevilka}: ${status.label}${showSolution ? `, rešitev ${task.resitev}` : ''}`}
    >
      <span className="mark-symbol" aria-hidden="true">{status.symbol}</span>
      <span className="mark-number" aria-hidden="true">{index + 1}</span>
      {showSolution && task.resitev && (
        <span className={`mark-solution side-${labelSide}`} aria-hidden="true">
          {task.resitev}
        </span>
      )}
    </button>
  );
}

export default function CheckResult() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [showMarks, setShowMarks] = useState(true);

  useEffect(() => {
    let objectUrl;
    setData(null);
    setError('');
    Promise.all([api.get(`/api/checks/${id}`), api.get(`/api/checks/${id}/image`, { responseType: 'blob' })])
      .then(([check, image]) => {
        objectUrl = URL.createObjectURL(image.data);
        setImageUrl(objectUrl);
        setData(check.data);
      })
      .catch(err => setError(errorMessage(err, 'Pregleda ni bilo mogoče naložiti.')));
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [id]);

  if (error) {
    return (
      <main className="page page-narrow">
        <p className="form-error">{error}</p>
      </main>
    );
  }
  if (!data) return <p className="page-loading">Nalagam pregledan list…</p>;

  const { result } = data;
  const allCorrect = data.correct === data.total;

  return (
    <main className="page check-page">
      <header className="check-header">
        <p className="kicker">
          {data.subject} · {formatDate(data.created_at, { day: 'numeric', month: 'long', year: 'numeric' })} →
        </p>
        <h1>{result.naslov}</h1>
        <p className="check-score">
          {data.correct} / {data.total} pravilno{allCorrect ? ' — odlično!' : ''}
        </p>
        <p className="check-summary">{result.povzetek}</p>
      </header>

      <div className="check-grid">
        <figure className="sheet">
          <div className={`sheet-frame ${showMarks ? '' : 'marks-hidden'}`} onMouseLeave={() => setActive(null)}>
            <img src={imageUrl} alt="Fotografija rešenega učnega lista" />
            {result.naloge.map((task, i) => (
              <Mark key={i} task={task} index={i} active={active === i} onActivate={setActive} />
            ))}
          </div>
          <figcaption className="sheet-caption">
            <label className="marks-toggle">
              <input type="checkbox" checked={showMarks} onChange={e => setShowMarks(e.target.checked)} />
              pokaži oznake
            </label>
            <span>Številke na listu se ujemajo s seznamom.</span>
          </figcaption>
        </figure>

        <NoteCard tilt={0.8} as="section" className="task-card">
          <h2>Naloge</h2>
          <ol className="task-list">
            {result.naloge.map((task, i) => {
              const status = STATUS[task.status];
              return (
                <li
                  key={i}
                  className={`task-item ${status.className} ${active === i ? 'is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <span className="task-badge" aria-hidden="true">{i + 1}</span>
                  <div className="task-body">
                    <p className="task-head">
                      <span className="task-status">
                        <span aria-hidden="true">{status.symbol}</span> {status.label}
                      </span>
                      <span className="task-number">naloga {task.stevilka}</span>
                    </p>
                    <p className="task-question">{task.naloga}</p>
                    {task.odgovor_otroka && task.status !== 'neodgovorjeno' && (
                      <p className="task-answer">
                        {user.role === 'child' ? 'Tvoj odgovor' : 'Odgovor'}: <span>{task.odgovor_otroka}</span>
                      </p>
                    )}
                    {task.status !== 'pravilno' && task.resitev && (
                      <p className="task-solution">Rešitev: {task.resitev}</p>
                    )}
                    {task.status !== 'pravilno' && task.razlaga && <p className="task-explanation">{task.razlaga}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </NoteCard>
      </div>

      <p className="check-back">
        <Link to={user.role === 'child' ? '/child' : '/dashboard'}>← Nazaj</Link>
      </p>
    </main>
  );
}
