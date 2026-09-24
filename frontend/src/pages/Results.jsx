import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
        <h1>{content.naslov}</h1>
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
        <NoteCard tilt={0.9} as="div" className="note-video">
          <VideoNote />
        </NoteCard>
      </aside>
    </main>
  );
}
