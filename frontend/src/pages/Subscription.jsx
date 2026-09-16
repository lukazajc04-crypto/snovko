import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import NoteCard from '../components/NoteCard';
import '../styles/subscription.css';

const PLANS = [
  { id: 'basic', name: 'Basic', price: '9,90', tilt: -1, features: ['1 otrok', '50 gradiv na mesec (100 kreditov)', 'Pregled napredka'] },
  { id: 'standard', name: 'Standard', price: '14,90', tilt: 0.6, features: ['1 otrok', '250 gradiv na mesec (500 kreditov)', 'Pregled napredka', 'Večerni e-mail o učenju'] },
  { id: 'family', name: 'Družina', price: '19,90', tilt: 1, features: ['Do 3 otroci', '250 gradiv na mesec (500 kreditov)', 'Pregled napredka za vsakega', 'Večerni e-mail o učenju'] },
];

export default function Subscription() {
  const [searchParams] = useSearchParams();
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const cancelled = searchParams.get('placilo') === 'preklicano';

  useEffect(() => {
    api
      .get('/api/dashboard/parent')
      .then(res => setCredits(res.data.credits))
      .catch(err => setError(errorMessage(err)));
  }, []);

  async function choose(plan) {
    setError('');
    setLoading(plan);
    try {
      const res = await api.post('/api/stripe/create-subscription', { plan });
      window.location.assign(res.data.url);
    } catch (err) {
      setError(errorMessage(err, 'Plačila ni bilo mogoče začeti.'));
      setLoading(null);
    }
  }

  const currentPlan = credits?.subscribed ? credits.plan : null;

  return (
    <main className="page subscription-page">
      <p className="kicker">naročnina →</p>
      <h1>{currentPlan ? 'Vaša naročnina' : 'Izberite paket'}</h1>
      <p className="lead subscription-lead">
        {currentPlan
          ? `Imate paket ${PLANS.find(p => p.id === currentPlan)?.name}. Na voljo je ${credits.balance} kreditov.`
          : 'Prvih 7 dni je brezplačnih. Naročnino lahko kadarkoli prekličete.'}
      </p>

      {cancelled && <p className="hand-note subscription-note">Plačilo je bilo preklicano — paket lahko izberete kadarkoli.</p>}
      {error && (
        <p className="form-error subscription-error" role="alert">
          {error}
        </p>
      )}

      <ul className="subscription-plans">
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentPlan;
          return (
            <li key={plan.id}>
              <NoteCard tilt={plan.tilt} as="div" className={`sub-plan ${isCurrent ? 'is-current' : ''}`}>
                {isCurrent && <p className="plan-badge">vaš paket</p>}
                <h2>{plan.name}</h2>
                <p className="sub-price">
                  <span>{plan.price}&nbsp;€</span> / mesec
                </p>
                <ul className="sub-features">
                  {plan.features.map(f => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {!currentPlan && (
                  <button
                    type="button"
                    className={`btn ${plan.id === 'standard' ? 'btn-primary' : ''}`}
                    onClick={() => choose(plan.id)}
                    disabled={loading !== null}
                  >
                    {loading === plan.id ? 'Odpiram plačilo…' : 'Začni brezplačno — 7 dni'}
                  </button>
                )}
              </NoteCard>
            </li>
          );
        })}
      </ul>

      <p className="subscription-back">
        <Link to="/dashboard">← Nazaj na pregled</Link>
      </p>
    </main>
  );
}
