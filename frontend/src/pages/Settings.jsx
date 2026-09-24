import { useState } from 'react';
import NoteCard from '../components/NoteCard';
import api, { errorMessage } from '../api';
import '../styles/settings.css';

const TUTORIAL_KEYS = ['snovko_tutorial_done', 'snovko_parent_tutorial_done'];
const MIN_PASSWORD = 8;

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('');
    setSubmitting(true);
    try {
      const res = await api.post('/api/auth/change-password', { current_password: current, password: next });
      setStatus(res.data.message);
      setCurrent('');
      setNext('');
    } catch (err) {
      setError(errorMessage(err, 'Gesla ni bilo mogoče spremeniti.'));
    }
    setSubmitting(false);
  }

  return (
    <NoteCard tilt={0.6}>
      <h2>Geslo</h2>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Trenutno geslo</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Novo geslo</span>
          <input
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            value={next}
            onChange={e => setNext(e.target.value)}
            placeholder={`Vsaj ${MIN_PASSWORD} znakov`}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {status && (
          <p className="hand-note" role="status">
            {status}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Shranjujem…' : 'Spremeni geslo'}
        </button>
      </form>
    </NoteCard>
  );
}

export default function Settings() {
  const [done, setDone] = useState(false);

  function repeatTutorial() {
    TUTORIAL_KEYS.forEach(key => localStorage.removeItem(key));
    setDone(true);
  }

  return (
    <main className="page page-narrow settings-page">
      <p className="kicker">nastavitve →</p>
      <h1>Nastavitve</h1>

      <NoteCard tilt={-0.8}>
        <h2>Uvodni vodič</h2>
        <p className="prose">
          Ponovno prikaže vodič po pregledu za starše in po otroški strani, ob naslednjem obisku vsake od njiju.
        </p>
        <button type="button" className="btn btn-primary" onClick={repeatTutorial} disabled={done}>
          {done ? 'Vodič bo prikazan znova ✓' : 'Ponovi uvodni vodič'}
        </button>
        {done && (
          <p className="hand-note settings-note" role="status">
            Obišči /dashboard ali otrokov /child, da ga vidiš.
          </p>
        )}
      </NoteCard>

      <PasswordCard />
    </main>
  );
}
