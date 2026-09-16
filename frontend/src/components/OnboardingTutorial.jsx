import { useLayoutEffect, useRef, useState } from 'react';
import '../styles/tutorial.css';

const SPOTLIGHT_PADDING = 8;
const CARD_MARGIN = 16;
const CARD_GAP = 20;

function useSpotlightRect(targetRef) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    function measure() {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - SPOTLIGHT_PADDING,
        left: r.left - SPOTLIGHT_PADDING,
        width: r.width + SPOTLIGHT_PADDING * 2,
        height: r.height + SPOTLIGHT_PADDING * 2,
      });
    }

    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    measure();
    const timer = setTimeout(measure, 350); // po morebitnem scrollIntoView animiranju

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [targetRef]);

  return rect;
}

export default function OnboardingTutorial({ steps, onDone }) {
  const [index, setIndex] = useState(0);
  const [cardPos, setCardPos] = useState(null);
  const cardRef = useRef(null);
  const step = steps[index];
  const rect = useSpotlightRect(step.targetRef);

  useLayoutEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Postavi kartico glede na spotlight, nato jo "clampa" v okvir zaslona — spotlight je lahko
  // višji od zaslona (npr. na mobilnem), zato golo "pod/nad elementom" ne zadostuje
  useLayoutEffect(() => {
    if (!rect || !cardRef.current) {
      setCardPos(null);
      return;
    }
    const cardEl = cardRef.current;
    const cardHeight = cardEl.offsetHeight;
    const cardWidth = cardEl.offsetWidth;

    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const placeBelow = spaceBelow >= cardHeight + CARD_GAP || spaceBelow >= spaceAbove;

    let top = placeBelow ? rect.top + rect.height + CARD_GAP : rect.top - CARD_GAP - cardHeight;
    top = Math.max(CARD_MARGIN, Math.min(top, window.innerHeight - cardHeight - CARD_MARGIN));

    let left = rect.left + rect.width / 2 - cardWidth / 2;
    left = Math.max(CARD_MARGIN, Math.min(left, window.innerWidth - cardWidth - CARD_MARGIN));

    setCardPos({ top, left });
  }, [rect, index]);

  function next() {
    if (index === steps.length - 1) onDone();
    else setIndex(i => i + 1);
  }

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-label="Vodič po Snovku">
      {rect && (
        <div
          className="tutorial-spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      <div
        ref={cardRef}
        className="tutorial-card"
        style={cardPos ? { top: cardPos.top, left: cardPos.left } : { top: 0, left: 0, visibility: 'hidden' }}
      >
        <button type="button" className="tutorial-skip" onClick={onDone}>
          Preskoči tutorial
        </button>
        <p className="tutorial-step">
          Korak {index + 1} od {steps.length}
        </p>
        <h2>{step.title}</h2>
        <p className="tutorial-text">{step.text}</p>
        <button type="button" className="btn btn-primary tutorial-next" onClick={next}>
          {step.buttonLabel}
        </button>
      </div>
    </div>
  );
}
