import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import NoteCard from '../components/NoteCard';
import { formatDate } from '../constants';
import '../styles/worksheet.css';

// Koliko črt za pisanje dobi naloga na papirju
const LINES = { racun: 1, kratek: 2, dolg: 4 };

function TaskLines({ tip }) {
  return (
    <span className="task-lines" aria-hidden="true">
      {Array.from({ length: LINES[tip] ?? 2 }, (_, i) => (
        <span key={i} className="task-line" />
      ))}
    </span>
  );
}

export default function Worksheet() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showSolutions, setShowSolutions] = useState(false);

  useEffect(() => {
    api
      .get(`/api/exercises/${id}`)
      .then(res => setData(res.data))
      .catch(err => setError(errorMessage(err, 'Učnega lista ni bilo mogoče naložiti.')));
  }, [id]);

  if (error) {
    return (
      <main className="page page-narrow">
        <p className="form-error">{error}</p>
      </main>
    );
  }
  if (!data) return <p className="page-loading">Nalagam učni list…</p>;

  const { sheet, child } = data;

  return (
    <main className="page page-narrow worksheet-page">
      <div className="worksheet-head">
        <div>
          <p className="kicker">
            učni list · {child.name}, {child.grade}. razred ·{' '}
            {formatDate(sheet.created_at, { day: 'numeric', month: 'long' })} →
          </p>
          <h1>{sheet.naslov}</h1>
        </div>
        <button type="button" className="btn btn-small print-action" onClick={() => window.print()}>
          <svg className="print-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 9V4h10v5" />
            <path d="M7 19H5.5A2.5 2.5 0 0 1 3 16.5v-4A2.5 2.5 0 0 1 5.5 10h13a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2.5 2.5H17" />
            <path d="M7 15h10v6H7z" />
          </svg>
          Natisni
        </button>
      </div>

      <p className="worksheet-intro">{sheet.navodilo}</p>

      <NoteCard tilt={-0.5} as="div" className="worksheet-card">
        <ol className="task-list">
          {sheet.naloge.map((task, i) => (
            <li key={i} className="task">
              <p className="task-text">{task.besedilo}</p>
              <TaskLines tip={task.tip} />
              {showSolutions && task.resitev && (
                <div className="task-solution">
                  <p className="task-answer">
                    <strong>Rešitev:</strong> {task.resitev}
                  </p>
                  {task.razlaga && <p className="task-why">{task.razlaga}</p>}
                </div>
              )}
            </li>
          ))}
        </ol>
      </NoteCard>

      {sheet.resitve_vidne ? (
        <div className="worksheet-actions">
          <button type="button" className="btn" onClick={() => setShowSolutions(v => !v)}>
            {showSolutions ? 'Skrij rešitve' : 'Pokaži rešitve'}
          </button>
          <p className="hand-note">Rešitve se natisnejo na ločen list, da jih otrok ne vidi vnaprej.</p>
        </div>
      ) : (
        <p className="hand-note worksheet-locked">Rešitve vidi starš v svojem računu.</p>
      )}

      <p className="worksheet-back">
        <Link to={`/results/${sheet.generation_id}`}>← nazaj na gradivo</Link>
      </p>

      {/* Različica za papir: naloge s črtami, rešitve na svojem listu */}
      <div className="print-sheet" aria-hidden="true">
        <header className="print-head">
          <p className="print-kicker">
            {child.name}, {child.grade}. razred · ime: ______________________
          </p>
          <h1>{sheet.naslov}</h1>
          <p className="print-intro">{sheet.navodilo}</p>
        </header>

        <ol className="print-tasks">
          {sheet.naloge.map((task, i) => (
            <li key={i}>
              <p className="print-q">{task.besedilo}</p>
              <TaskLines tip={task.tip} />
            </li>
          ))}
        </ol>

        {sheet.resitve_vidne && (
          <section className="print-answers">
            <h2>Rešitve — za starše</h2>
            <ol>
              {sheet.naloge.map((task, i) => (
                <li key={i}>
                  <strong>{task.resitev}</strong>
                  {task.razlaga && <span className="print-why"> — {task.razlaga}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="print-footer">Snovko · {sheet.naslov}</p>
      </div>
    </main>
  );
}
