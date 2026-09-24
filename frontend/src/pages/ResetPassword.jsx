import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import { errorMessage } from '../api';
import { homePathFor, useAuth } from '../context/AuthContext';

const MIN_PASSWORD = 8;

export default function ResetPassword() {
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== repeat) {
      setError('Gesli se ne ujemata.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const user = await resetPassword(token, password);
      navigate(homePathFor(user), { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Gesla ni bilo mogoče ponastaviti.'));
      setSubmitting(false);
    }
  }

  return (
    <main className="page page-narrow">
      <NoteCard tilt={-1}>
        <h1>Novo geslo</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Novo geslo</span>
            <input
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={`Vsaj ${MIN_PASSWORD} znakov`}
            />
          </label>
          <label className="field">
            <span>Ponovite geslo</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={repeat}
              onChange={e => setRepeat(e.target.value)}
              placeholder="Še enkrat"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Shranjujem…' : 'Shrani geslo'}
          </button>
        </form>
        <p className="form-foot">
          <Link to="/pozabljeno-geslo">Povezava ne deluje več? Zahtevajte novo</Link>
        </p>
      </NoteCard>
    </main>
  );
}
