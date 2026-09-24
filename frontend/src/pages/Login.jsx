import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import { errorMessage } from '../api';
import { homePathFor, useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !submitting) return <Navigate to={homePathFor(user)} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      navigate(location.state?.from || homePathFor(loggedIn), { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Prijava ni uspela.'));
      setSubmitting(false);
    }
  }

  return (
    <main className="page page-narrow">
      <NoteCard tilt={-1}>
        <h1>Prijava</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>E-mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ime@primer.si" />
          </label>
          <label className="field">
            <span>Geslo</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Tvoje geslo" />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Prijavljam…' : 'Prijavi se'}
          </button>
        </form>
        <p className="form-footer">
          <Link to="/pozabljeno-geslo">Pozabljeno geslo?</Link>
        </p>
        <p className="form-footer">
          Še nimaš računa? <Link to="/register">Registriraj se</Link>
        </p>
      </NoteCard>
    </main>
  );
}
