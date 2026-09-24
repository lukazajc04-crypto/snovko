import { Link } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import '../styles/landing.css';

const CTA_LABEL = 'Začni brezplačno — 7 dni';

const STEPS = [
  {
    title: 'Fotografira snov',
    text: 'Otrok slika stran iz zvezka ali delovni list. Deluje tudi PDF ali navadno besedilo.',
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M7 16.5c0-2 1.5-3.5 3.5-3.5h5l3-4.5h11l3 4.5h5c2 0 3.5 1.5 3.5 3.5v19c0 2-1.5 3.5-3.5 3.5h-27C8.5 39 7 37.5 7 35.5z" />
        <circle cx="24" cy="26" r="7.5" />
      </svg>
    ),
  },
  {
    title: 'AI pripravi gradivo',
    text: 'V dveh minutah dobi razlago v preprostem jeziku, kartončke in kviz za svoj razred.',
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M12 8h19l7 7v25H12z" />
        <path d="M31 8v7h7M18 22h14M18 28h14M18 34h8" />
        <path d="M38 30l1.6 3.4L43 35l-3.4 1.6L38 40l-1.6-3.4L33 35l3.4-1.6z" />
      </svg>
    ),
  },
  {
    title: 'Se uči, vi spremljate',
    text: 'Otrok ponavlja s kartončki in rešuje kviz. Vi vidite, katere teme mu še ne gredo.',
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M8 38h32" />
        <path d="M13 38V26M21 38V18M29 38v-9M37 38V12" />
        <path d="M11 20l9-8 7 5 11-9" />
      </svg>
    ),
  },
];

const PLANS = [
  {
    name: 'Basic',
    price: '11,90',
    tilt: -1.2,
    features: ['1 otrok', '50 gradiv na mesec', 'Razlaga, kartončki in kviz', 'Pregled napredka za starše'],
  },
  {
    name: 'Standard',
    price: '17,90',
    tilt: 0.6,
    featured: true,
    features: ['1 otrok', '250 gradiv na mesec', 'Razlaga, kartončki in kviz', 'Pregled napredka za starše', 'Večerni e-mail o tem, kaj se je učil'],
  },
  {
    name: 'Družina',
    price: '22,90',
    tilt: 1.2,
    features: ['Do 3 otroci', '250 gradiv na mesec', 'Razlaga, kartončki in kviz', 'Pregled napredka za vsakega otroka', 'Večerni e-mail o tem, kaj se je učil'],
  },
];

function HeroExample() {
  return (
    <figure className="hero-example" aria-label="Primer: zapisek iz zvezka in gradivo, ki ga pripravi Snovko">
      <div className="notebook-page" aria-hidden="true">
        <p className="notebook-title">Kroženje vode</p>
        <p>sonce segreje vodo → izhlapi</p>
        <p>para → oblaki (kondenzacija)</p>
        <p>padavine: dež, sneg, toča</p>
        <p>voda v zemljo = podtalnica</p>
      </div>

      <p className="example-arrow" aria-hidden="true">
        2 minuti pozneje
        <svg viewBox="0 0 90 40">
          <path d="M4 8c22 2 48 8 70 24" />
          <path d="M62 31l13 2-4-12" />
        </svg>
      </p>

      <NoteCard tilt={1.5} className="example-summary" as="div">
        <p className="kicker">iz naravoslovja, 5. razred →</p>
        <h3>Kroženje vode v naravi</h3>
        <p className="prose">
          Sonce segreje vodo v morjih in rekah, zato <span className="hl">izhlapi</span> in se dvigne v zrak. Visoko
          se para ohladi in nastanejo <span className="hl-green">oblaki</span>.
        </p>
        <ul className="term-pills">
          <li>izhlapevanje</li>
          <li>kondenzacija</li>
          <li>padavine</li>
        </ul>
      </NoteCard>

      <NoteCard tilt={-4} className="example-flashcard" as="div">
        <p className="flashcard-label">kartonček 1 od 5</p>
        <p className="flashcard-question">Kaj je izhlapevanje?</p>
        <p className="hand-note">klikni za obrat ↻</p>
      </NoteCard>
    </figure>
  );
}

export default function Landing() {
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="kicker">za starše osnovnošolcev, od 1. do 9. razreda →</p>
          <h1>
            Vaš otrok dobi <span className="hl">razlago iz šolske snovi</span> v 2 minutah
          </h1>
          <p className="lead">
            Fotografira stran iz zvezka. AI naredi razlago, kviz in kartončke prilagojene razredu — brez pisanja
            poizvedb, brez čakanja na inštruktorja.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-large">
              {CTA_LABEL}
            </Link>
            <a href="#cenik" className="text-link">
              Poglej cenik ↓
            </a>
          </div>
          <ul className="hero-reassure">
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
              Ni vam treba znati uporabljati AI — samo slikate.
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
              Nikoli ne obtičite sredi naloge, ker vam je zmanjkalo brezplačnih sporočil.
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
              Vse lahko natisnete — razlago in učni list z nalogami, da se otrok uči brez zaslona.
            </li>
          </ul>
        </div>
        <HeroExample />
      </section>

      <section className="landing-section" id="kako-deluje" aria-labelledby="kako-deluje-naslov">
        <p className="kicker">kako deluje →</p>
        <h2 id="kako-deluje-naslov">Od zvezka do znanja v treh korakih</h2>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <NoteCard tilt={[-1.2, 0.8, -0.6][i]} as="div" className="step-card">
                <span className="step-number" aria-hidden="true">{i + 1}.</span>
                <span className="step-icon">{step.icon}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </NoteCard>
            </li>
          ))}
        </ol>

        <NoteCard tilt={0.7} as="div" className="video-teaser">
          <div className="video-teaser-text">
            <p className="video-teaser-head">
              <span className="video-soon">kmalu</span>
              Video razlaga s slovenskim glasom
            </p>
            <p>
              Za otroke, ki si lažje zapomnijo, kar slišijo in vidijo — vsako snov bo mogoče dobiti tudi kot kratek
              video z razlago in diagrami.
            </p>
          </div>
          <svg className="video-teaser-icon" viewBox="0 0 48 48" aria-hidden="true">
            <rect x="5" y="11" width="28" height="26" rx="3.5" />
            <path d="M33 22l10-6v16l-10-6z" />
            <path d="M15 19l8 5-8 5z" />
          </svg>
        </NoteCard>
      </section>

      <section className="landing-section" id="cenik" aria-labelledby="cenik-naslov">
        <p className="kicker">cenik →</p>
        <h2 id="cenik-naslov">Manj kot ena ura inštrukcij na mesec</h2>
        <p className="section-lead">Prvih 7 dni je brezplačnih. Naročnino lahko kadarkoli prekličete.</p>

        <ul className="plans">
          {PLANS.map(plan => (
            <li key={plan.name}>
              <NoteCard tilt={plan.tilt} as="div" className={`plan-card ${plan.featured ? 'plan-featured' : ''}`}>
                {plan.featured && <p className="plan-badge">priporočamo</p>}
                <h3>{plan.name}</h3>
                <p className="plan-price">
                  <span className="plan-amount">{plan.price}&nbsp;€</span>
                  <span className="plan-period">/ mesec</span>
                </p>
                <ul className="plan-features">
                  {plan.features.map(feature => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link to="/register" className={`btn ${plan.featured ? 'btn-primary' : ''}`}>
                  {CTA_LABEL}
                </Link>
              </NoteCard>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-cta" aria-labelledby="cta-naslov">
        <h2 id="cta-naslov">
          Naslednji test je <span className="hl">že kmalu</span>?
        </h2>
        <p className="lead">Naložite prvo snov še danes in poglejte, kaj pripravi Snovko.</p>
        <Link to="/register" className="btn btn-primary btn-large">
          {CTA_LABEL}
        </Link>
      </section>

    </main>
  );
}
