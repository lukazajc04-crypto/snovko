import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import { errorMessage } from '../api';
import { homePathFor, useAuth } from '../context/AuthContext';

export default function Register() {
  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'parent', access_code: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !submitting) return <Navigate to={homePathFor(user)} replace />;

  const update = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { access_code, ...fields } = form;
      const created = await register(fields.role === 'child' && access_code.trim() ? { ...fields, access_code } : fields);
      navigate(created.role === 'parent' ? '/onboarding' : '/child', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Registracija ni uspela.'));
      setSubmitting(false);
    }
  }

  return (
    <main className="page page-narrow">
      <NoteCard tilt={1}>
        <h1>Ustvari račun</h1>
        <form className="form" onSubmit={handleSubmit}>
          <div className="role-toggle" role="radiogroup" aria-label="Vloga">
            {[
              ['parent', 'Sem starš'],
              ['child', 'Sem učenec'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.role === value}
                className={`btn ${form.role === value ? 'btn-primary' : ''}`}
                onClick={() => setForm(f => ({ ...f, role: value }))}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Ime</span>
            <input required autoComplete="given-name" value={form.name} onChange={update('name')} placeholder="Tvoje ime" />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input type="email" required autoComplete="email" value={form.email} onChange={update('email')} placeholder="ime@primer.si" />
          </label>
          <label className="field">
            <span>Geslo</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={update('password')} placeholder="Vsaj 8 znakov" />
          </label>
          {form.role === 'child' && (
            <label className="field">
              <span>Koda od starša</span>
              <input
                value={form.access_code}
                onChange={update('access_code')}
                placeholder="Na primer BPBT2D"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={6}
              />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Ustvarjam račun…' : 'Ustvari račun'}
          </button>
        </form>
        <p className="form-footer">
          Že imaš račun? <Link to="/login">Prijavi se</Link>
        </p>
      </NoteCard>
    </main>
  );
}
