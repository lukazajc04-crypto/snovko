import { useState } from 'react';

export default function FlashcardDeck({ cards }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  function go(delta) {
    setFlipped(false);
    setIndex(i => (i + delta + cards.length) % cards.length);
  }

  return (
    <div className="deck">
      <div className="note-head">
        <h2>Kartončki</h2>
        <span className="note-counter">
          kartica {index + 1} od {cards.length}
        </span>
      </div>

      <button
        type="button"
        className={`flashcard ${flipped ? 'is-flipped' : ''}`}
        onClick={() => setFlipped(f => !f)}
        aria-label={flipped ? `Odgovor: ${card.odgovor}. Klikni za vprašanje.` : `Vprašanje: ${card.vprasanje}. Klikni za odgovor.`}
      >
        <span className="flashcard-inner">
          <span className="flashcard-face flashcard-front" aria-hidden={flipped}>
            <span className="flashcard-side">vprašanje</span>
            <span className="flashcard-text">{card.vprasanje}</span>
          </span>
          <span className="flashcard-face flashcard-back" aria-hidden={!flipped}>
            <span className="flashcard-side">odgovor</span>
            <span className="flashcard-text">{card.odgovor}</span>
          </span>
        </span>
      </button>

      <div className="deck-nav">
        <button type="button" className="btn btn-small" onClick={() => go(-1)} aria-label="Prejšnja kartica">
          ←
        </button>
        <span className="hand-note">klikni za obrat ↻</span>
        <button type="button" className="btn btn-small" onClick={() => go(1)} aria-label="Naslednja kartica">
          →
        </button>
      </div>
    </div>
  );
}
