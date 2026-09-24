import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import NoteCard from '../components/NoteCard';
import FlashcardDeck from '../components/FlashcardDeck';
import QuizCard from '../components/QuizCard';
import VoiceReaderCard from '../components/VoiceReaderCard';
import useVoiceReader from '../hooks/useVoiceReader';
import { formatDate } from '../constants';
import '../styles/results.css';

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Slovenske besede se sklanjajo ("ulomek" → "ulomka"), zato iščemo po korenu zadnje besede pojma
function termPattern(term) {
  const words = term.replace(/\(.*?\)/g, '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const last = words.pop();
  const stem = last.length > 6 ? last.slice(0, -2) : last.length > 4 ? last.slice(0, -1) : last;
  const phrase = [...words.map(escapeRegExp), `${escapeRegExp(stem)}\\p{L}*`].join('\\s+');
  return new RegExp(`(?<!\\p{L})${phrase}`, 'iu');
}

// Vrne nezložene (start, end) obsege ključnih pojmov za vsak odstavek posebej
function computeTermRanges(paragraphs, terms) {
  const patterns = terms.map(termPattern).filter(Boolean);
  const used = new Set();

  return paragraphs.map(paragraph => {
    const matches = [];
    patterns.forEach((pattern, i) => {
      if (used.has(i)) return;
      const m = pattern.exec(paragraph);
      if (!m) return;
      const start = m.index;
      const end = start + m[0].length;
      if (matches.some(o => start < o.end && end > o.start)) return;
      matches.push({ start, end });
      used.add(i);
    });
    matches.sort((a, b) => a.start - b.start);
    return matches;
  });
}

// Razreže odstavek na zaporedne kose glede na pojme + trenutno brano besedo, brez prekrivanja
function renderParagraph(text, termRanges, currentWord) {
  const points = new Set([0, text.length]);
  termRanges.forEach(r => {
    points.add(r.start);
    points.add(r.end);
  });
  if (currentWord) {
    points.add(currentWord.start);
    points.add(currentWord.end);
  }

  const sorted = [...points].sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const isTerm = termRanges.some(r => r.start <= start && r.end >= end);
    const isCurrent = currentWord && currentWord.start <= start && currentWord.end >= end;
    segments.push({ text: text.slice(start, end), isTerm, isCurrent });
  }
  return segments;
}

// Starejša gradiva imajo izpisek kot en sam dolg odstavek; razdelimo ga po stavkih na tri približno enake dele
function splitParagraphs(izpisek) {
  const parts = izpisek.split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean);
  if (parts.length > 1 || izpisek.length < 450) return parts;

  const sentences = izpisek.match(/[^.!?]+[.!?]+(\s+|$)/g) || [izpisek];
  const target = izpisek.length / 3;
  const chunks = [''];
  sentences.forEach(sentence => {
    if (chunks[chunks.length - 1].length >= target && chunks.length < 3) chunks.push('');
    chunks[chunks.length - 1] += sentence;
  });
  return chunks.map(c => c.trim()).filter(Boolean);
}

function ProgressNote({ progress, currentId }) {
  const percent = progress.percent;
  return (
    <div className="progress-note">
      <div className="note-head">
        <h2>Napredek</h2>
        <span className="note-counter">{progress.subject}</span>
      </div>
      {percent === null ? (
        <p className="hand-note">Reši kviz, pa bomo pokazali, koliko te snovi že obvladaš.</p>
      ) : (
        <>
          <p className="progress-percent">
            <span>{percent}&nbsp;%</span> obvladanosti
          </p>
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Obvladanost predmeta ${progress.subject}`}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="progress-meta">
            iz {progress.quizzes} {progress.quizzes === 1 ? 'kviza' : 'kvizov'}
          </p>
          {progress.weakest && (
            <p className="progress-weakest">
              Najšibkejše:{' '}
              {progress.weakest.id === currentId ? (
                <strong>{progress.weakest.naslov}</strong>
              ) : (
                <Link to={`/results/${progress.weakest.id}`}>{progress.weakest.naslov}</Link>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function VideoNote() {
  const [interested, setInterested] = useState(false);
  return (
    <div className="video-note">
      <div className="note-head">
        <h2>Video razlaga</h2>
        <span className="video-soon">kmalu</span>
      </div>
      <p>
        Ta snov, razložena v <strong>videu s slovenskim glasom</strong> in diagrami — za otroke, ki si lažje
        zapomnijo, kar slišijo in vidijo.
      </p>
      <button
        type="button"
        className="btn"
        onClick={() => setInterested(true)}
        disabled={interested}
        aria-live="polite"
      >
        {interested ? 'Hvala — javimo vam ✓' : 'Zanima me'}
      </button>
      <p className="hand-note">
        {interested
          ? 'Ko bo video pripravljen, vas obvestimo po e-pošti.'
          : 'Predvidena cena okoli 4,90 € na video.'}
      </p>
    </div>
  );
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
const WORKSHEET_COST = 2;

function WorksheetNote({ generationId }) {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/exercises', { params: { generation_id: generationId } })
      .then(res => setSheets(res.data.sheets))
      .catch(() => setSheets([]));
  }, [generationId]);

  async function create() {
    setError('');
    setWorking(true);
    try {
      const res = await api.post('/api/exercises', { generation_id: generationId });
      navigate(`/ucni-list/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Učnega lista ni bilo mogoče sestaviti.'));
      setWorking(false);
    }
  }

  return (
    <div className="worksheet-note">
      <div className="note-head">
        <h2>Učni list</h2>
        <span className="note-counter">{WORKSHEET_COST} kredita</span>
      </div>
      <p>Naloge iz te snovi za reševanje na papir. Starš dobi rešitve na ločenem listu.</p>

      {sheets.length > 0 && (
        <ul className="sheet-list">
          {sheets.map(s => (
            <li key={s.id}>
              <Link to={`/ucni-list/${s.id}`}>
                Učni list · {formatDate(s.created_at, { day: 'numeric', month: 'long' })}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn btn-primary" onClick={create} disabled={working}>
        {working ? 'Sestavljam…' : sheets.length > 0 ? 'Sestavi novega' : 'Sestavi učni list'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Za papir se vse pokaže naenkrat — kartončki in kviz na zaslonu odgovore skrijejo
// do klika, kar na natisnjenem listu nima smisla. Rešitve gredo na svojo stran,
// da lahko otrok najprej reši in šele nato preveri.
function PrintSheet({ content, paragraphs, date }) {
  return (
    <div className="print-sheet" aria-hidden="true">
      <header className="print-head">
        <p className="print-kicker">
          {content.kicker} · {date}
        </p>
        <h1>{content.naslov}</h1>
      </header>

      <section className="print-block">
        <h2>Razlaga</h2>
        {paragraphs.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </section>

      <section className="print-block">
        <h2>Ključni pojmi</h2>
        <ul className="print-terms">
          {content.pojmi.map(term => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </section>

      <section className="print-block">
        <h2>Kartončki za učenje</h2>
        <ol className="print-cards">
          {content.kartoncki.map((c, i) => (
            <li key={i}>
              <p className="print-q">{c.vprasanje}</p>
              <p className="print-a">{c.odgovor}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="print-block print-quiz">
        <h2>Kviz</h2>
        <ol className="print-questions">
          {content.kviz.map((q, i) => (
            <li key={i}>
              <p className="print-q">{q.vprasanje}</p>
              <ul className="print-options">
                {q.opcije.map((opt, oi) => (
                  <li key={oi}>
                    <span className="print-box" /> {LETTERS[oi]}) {opt}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="print-block print-answers">
        <h2>Rešitve</h2>
        <ol>
          {content.kviz.map((q, i) => (
            <li key={i}>
              <strong>
                {LETTERS[q.pravilni_index]}) {q.opcije[q.pravilni_index]}
              </strong>
              {q.razlaga && <span className="print-why"> — {q.razlaga}</span>}
            </li>
          ))}
        </ol>
      </section>

      <p className="print-footer">Snovko · {content.naslov}</p>
    </div>
  );
}

export default function Results() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get(`/api/generations/${id}`)
      .then(res => setData(res.data))
      .catch(err => setError(errorMessage(err, 'Gradiva ni bilo mogoče naložiti.')));
  }, [id]);

  const paragraphs = useMemo(() => (data ? splitParagraphs(data.content.izpisek) : []), [data]);
  const termRanges = useMemo(() => computeTermRanges(paragraphs, data?.content.pojmi ?? []), [paragraphs, data]);
  const voice = useVoiceReader(paragraphs);

  async function saveQuiz(score, total) {
    try {
      const res = await api.post(`/api/generations/${id}/quiz-results`, { score, total });
      setData(d => ({ ...d, progress: res.data.progress }));
    } catch {
      // Rezultat se ne shrani, otrok pa vseeno vidi svoj izid
    }
  }

  if (error) {
    return (
      <main className="page page-narrow">
        <p className="form-error">{error}</p>
      </main>
    );
  }
  if (!data) return <p className="page-loading">Nalagam gradivo…</p>;

  const { content } = data;

  return (
    <main className="page results-page">
      <article className="results-summary">
        <p className="kicker">
          {content.kicker} · {formatDate(data.created_at, { day: 'numeric', month: 'long', year: 'numeric' })} →
        </p>
        <div className="results-title-row">
          <h1>{content.naslov}</h1>
          <button type="button" className="btn btn-small print-action" onClick={() => window.print()}>
            <svg className="print-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 9V4h10v5" />
              <path d="M7 19H5.5A2.5 2.5 0 0 1 3 16.5v-4A2.5 2.5 0 0 1 5.5 10h13a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2.5 2.5H17" />
              <path d="M7 15h10v6H7z" />
            </svg>
            Natisni
          </button>
        </div>
        <div className="summary-text">
          {paragraphs.map((text, pi) => (
            <p key={pi}>
              {renderParagraph(text, termRanges[pi] ?? [], voice.currentWord?.paragraphIndex === pi ? voice.currentWord : null).map(
                (seg, si) =>
                  seg.isTerm || seg.isCurrent ? (
                    <mark key={si} className={`${seg.isTerm ? 'hl' : ''} ${seg.isCurrent ? 'tts-current' : ''}`.trim()}>
                      {seg.text}
                    </mark>
                  ) : (
                    <Fragment key={si}>{seg.text}</Fragment>
                  )
              )}
            </p>
          ))}
        </div>

        <VoiceReaderCard {...voice} />

        <h2 className="terms-title">Ključni pojmi</h2>
        <ul className="term-list">
          {content.pojmi.map((term, i) => (
            <li key={term} style={{ '--tilt': `${i % 2 === 0 ? -0.5 : 0.5}deg` }}>
              {term}
            </li>
          ))}
        </ul>
      </article>

      <aside className="results-notes" aria-label="Učenje">
        <NoteCard tilt={-1} as="div">
          <FlashcardDeck cards={content.kartoncki} />
        </NoteCard>
        <NoteCard tilt={1} as="div">
          <QuizCard key={data.id} questions={content.kviz} onFinish={saveQuiz} />
        </NoteCard>
        <NoteCard tilt={-0.8} as="div">
          <ProgressNote progress={data.progress} currentId={data.id} />
        </NoteCard>
        <NoteCard tilt={0.6} as="div" className="note-worksheet">
          <WorksheetNote generationId={data.id} />
        </NoteCard>
        <NoteCard tilt={0.9} as="div" className="note-video">
          <VideoNote />
        </NoteCard>
      </aside>

      <PrintSheet
        content={content}
        paragraphs={paragraphs}
        date={formatDate(data.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}
      />
    </main>
  );
}
