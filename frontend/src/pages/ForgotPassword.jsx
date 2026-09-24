import { useState } from 'react';
import { Link } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import api, { errorMessage } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/api/auth/forgot-password', { email });
      setSent(res.data.message);
    } catch (err) {
      setError(errorMessage(err, 'Zahteve ni bilo mogoče poslati.'));
    }
    setSubmitting(false);
  }

  return (
    <main className="page page-narrow">
      <NoteCard tilt={-1}>
        <h1>Pozabljeno geslo</h1>

        {sent ? (
          <>
            <p className="prose" role="status">
              {sent}
            </p>
            <p className="hand-note">Povezava velja eno uro. Preverite tudi mapo z vsiljeno pošto.</p>
            <p className="form-foot">
              <Link to="/login">← nazaj na prijavo</Link>
            </p>
          </>
        ) : (
          <>
            <p className="prose">Vpišite e-mail svojega računa in poslali vam bomo povezavo za novo geslo.</p>
            <form className="form" onSubmit={handleSubmit}>
              <label className="field">
                <span>E-mail</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ime@primer.si"
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Pošiljam…' : 'Pošlji povezavo'}
              </button>
            </form>
            <p className="form-foot">
              <Link to="/login">← nazaj na prijavo</Link>
            </p>
          </>
        )}
      </NoteCard>
    </main>
  );
}
