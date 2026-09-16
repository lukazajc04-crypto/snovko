import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import NoteCard from '../components/NoteCard';
import { SUBJECTS } from '../constants';
import { useAuth } from '../context/AuthContext';
import '../styles/onboarding.css';

const STEPS = ['Otrok', 'Predmeti', 'Kako deluje'];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [child, setChild] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function toggleSubject(subject) {
    setSubjects(list => (list.includes(subject) ? list.filter(s => s !== subject) : [...list, subject]));
  }

  function nextFromChild(e) {
    e.preventDefault();
    setError('');
    setStep(1);
  }

  async function saveChild() {
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/api/children', { name, grade: Number(grade), subjects });
      setChild(res.data.child);
      setStep(2);
    } catch (err) {
      setError(errorMessage(err, 'Otroka ni bilo mogoče shraniti.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page page-onboarding">
      <div className="onboarding-progress" aria-label={`Korak ${step + 1} od ${STEPS.length}`}>
        <p className="kicker">
          korak {step + 1} od {STEPS.length} →
        </p>
        <ol className="step-track">
          {STEPS.map((label, i) => (
            <li key={label} className={i <= step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="step-bar" />
              <span className="step-label">{label}</span>
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <NoteCard tilt={-0.8}>
          <h1>Dobrodošli, {user.name}!</h1>
          <p className="lead">Za koga boste uporabljali Snovko?</p>
          <form className="form" onSubmit={nextFromChild}>
            <label className="field">
              <span>Ime otroka</span>
              <input required maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="Na primer Luka" />
            </label>
            <label className="field">
              <span>Razred</span>
              <select required value={grade} onChange={e => setGrade(e.target.value)}>
                <option value="" disabled>
                  Izberi razred
                </option>
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}. razred
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary">
              Naprej →
            </button>
          </form>
        </NoteCard>
      )}

      {step === 1 && (
        <NoteCard tilt={0.8}>
          <h1>Katere predmete se {name} uči?</h1>
          <p className="lead">Te bodo zavihki v njegovem zvezku. Kasneje lahko naloži snov iz kateregakoli predmeta.</p>
          <div className="subject-grid" role="group" aria-label="Predmeti">
            {SUBJECTS.map(subject => (
              <button
                key={subject}
                type="button"
                className={`subject-chip ${subjects.includes(subject) ? 'is-selected' : ''}`}
                aria-pressed={subjects.includes(subject)}
                onClick={() => toggleSubject(subject)}
              >
                {subjects.includes(subject) ? '✓ ' : ''}
                {subject}
              </button>
            ))}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="onboarding-actions">
            <button type="button" className="btn" onClick={() => setStep(0)} disabled={saving}>
              ← Nazaj
            </button>
            <button type="button" className="btn btn-primary" onClick={saveChild} disabled={saving || subjects.length === 0}>
              {saving ? 'Shranjujem…' : 'Naprej →'}
            </button>
          </div>
        </NoteCard>
      )}

      {step === 2 && child && (
        <NoteCard tilt={-0.6}>
          <h1>Tako deluje</h1>
          <ol className="how-list">
            <li>
              <span className="how-number">1.</span>
              <div>
                <h3>{child.name} si ustvari račun</h3>
                <p>
                  Na strani za registracijo izbere »Sem učenec« in vpiše to kodo:
                </p>
                <p className="access-code" aria-label={`Koda: ${child.access_code.split('').join(' ')}`}>
                  {child.access_code}
                </p>
              </div>
            </li>
            <li>
              <span className="how-number">2.</span>
              <div>
                <h3>Fotografira snov iz zvezka</h3>
                <p>AI v dveh minutah pripravi razlago, kartončke in kviz za {child.grade}. razred.</p>
              </div>
            </li>
            <li>
              <span className="how-number">3.</span>
              <div>
                <h3>Vi spremljate napredek</h3>
                <p>Na pregledu vidite, kaj se je učil in katere teme mu še ne gredo.</p>
              </div>
            </li>
          </ol>
          <div className="onboarding-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/subscription')}>
              Izberi paket — 7 dni brezplačno
            </button>
            <Link to="/dashboard" className="btn">
              Na pregled
            </Link>
          </div>
        </NoteCard>
      )}
    </main>
  );
}
