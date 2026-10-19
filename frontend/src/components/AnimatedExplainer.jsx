import { useEffect, useRef, useState } from 'react';
import useNarrator from '../hooks/useNarrator';
import { SceneView, sceneBeats } from './ExplainerScenes';
import '../styles/explainer.css';

const SPEEDS = [0.85, 1, 1.15];
const GAP_MS = 500;
const SILENT_STEP_MS = 1100;

// Brez glasu podnapis ostane toliko časa, da ga otrok prebere (~2,4 besede na sekundo)
const readingMs = text => Math.max(1800, text.split(/\s+/).filter(Boolean).length * 420);

function sleep(ms, signal) {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done);
  });
}

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  prev: 'M6 5h2.5v14H6zM19 5.5v13L9.5 12z',
  next: 'M15.5 5H18v14h-2.5zM5 5.5v13l9.5-6.5z',
  close: 'M6.5 5 12 10.5 17.5 5 19 6.5 13.5 12l5.5 5.5-1.5 1.5-5.5-5.5L6.5 19 5 17.5l5.5-5.5L5 6.5z',
  voiceOn: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15 8.5a4.5 4.5 0 0 1 0 7M17.5 6a8 8 0 0 1 0 12',
  voiceOff: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9.5l5 5M20.5 9.5l-5 5',
};

export default function AnimatedExplainer({ animation, title, onClose, onQuiz }) {
  const scenes = animation.prizori;
  const { available, speak, unlock } = useNarrator();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('ready'); // ready | playing | paused | done
  const [holding, setHolding] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speed, setSpeed] = useState(1);
  const dialogRef = useRef(null);
  const startRef = useRef(null);

  const scene = scenes[sceneIndex];
  const beats = sceneBeats(scene);
  const beat = beats[Math.min(step, beats.length - 1)];
  const speaking = voiceOn && available;

  // En takt: glas prebere poved (ali počakamo čas branja), po potrebi zadržimo, nato naprej
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    const sceneBeatList = sceneBeats(scenes[sceneIndex]);
    const current = sceneBeatList[step];

    (async () => {
      if (current.say && speaking) await speak(current.say, speed, signal);
      else await sleep((current.say ? readingMs(current.say) : SILENT_STEP_MS) / speed, signal);
      if (current.hold && !signal.aborted) {
        setHolding(true);
        await sleep(current.hold, signal);
      }
      await sleep(GAP_MS, signal);
      if (signal.aborted) return;
      setHolding(false);
      if (step < sceneBeatList.length - 1) setStep(step + 1);
      else if (sceneIndex < scenes.length - 1) {
        setSceneIndex(sceneIndex + 1);
        setStep(0);
      } else setStatus('done');
    })();

    return () => {
      controller.abort();
      setHolding(false);
    };
  }, [status, sceneIndex, step, speaking, speed, scenes, speak]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    startRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function play() {
    // Prvi dotik mora sprožiti govor neposredno, sicer ga iOS ne dovoli
    if (status === 'ready' || status === 'done') unlock();
    if (status === 'done') {
      setSceneIndex(0);
      setStep(0);
    }
    setStatus('playing');
  }

  function toggle() {
    if (status === 'playing') setStatus('paused');
    else play();
  }

  function goScene(index) {
    if (index < 0 || index >= scenes.length) return;
    if (status === 'ready') unlock();
    setSceneIndex(index);
    setStep(0);
    if (status !== 'paused') setStatus('playing');
  }

  function cycleSpeed() {
    setSpeed(s => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);
  }

  function handleKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowRight') {
      goScene(sceneIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      goScene(sceneIndex - 1);
    } else if (e.key === 'Tab') {
      // Fokus ostane v razlagi, dokler je odprta
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const speedLabel = `${speed.toLocaleString('sl-SI')}×`;

  return (
    <div
      className="explainer"
      role="dialog"
      aria-modal="true"
      aria-label={`Animirana razlaga: ${title}`}
      ref={dialogRef}
      onKeyDown={handleKey}
    >
      <header className="explainer-bar">
        <p className="explainer-name">
          <span className="explainer-tag">animirana razlaga</span>
          {title}
        </p>
        <button type="button" className="ctl" onClick={onClose} aria-label="Zapri razlago">
          <Icon d={ICONS.close} />
        </button>
      </header>

      <div className="board-frame">
        <div className={`board ${status === 'paused' ? 'is-paused' : ''}`} onClick={status === 'ready' ? undefined : toggle}>
          <div className="board-scene" key={sceneIndex}>
            <SceneView scene={scene} step={step} holding={holding} />
          </div>

          {status === 'ready' && (
            <div className="board-overlay">
              <button type="button" className="board-start" onClick={play} ref={startRef} aria-label="Začni razlago">
                <Icon d={ICONS.play} />
              </button>
              <p className="board-start-label">Začni razlago</p>
              {!available && (
                <p className="board-hint">Na tej napravi ni slovenskega glasu, zato razlaga teče s podnapisi.</p>
              )}
            </div>
          )}

          {status === 'done' && (
            <div className="board-overlay" onClick={e => e.stopPropagation()}>
              <p className="board-done">Bravo, konec razlage!</p>
              <div className="board-actions">
                <button type="button" className="btn" onClick={play}>
                  ↻ Poglej znova
                </button>
                {onQuiz && (
                  <button type="button" className="btn btn-primary" onClick={onQuiz}>
                    Reši kviz →
                  </button>
                )}
              </div>
            </div>
          )}

          <span className="board-signature" aria-hidden="true">
            Snovko
          </span>
        </div>
      </div>

      <p className="explainer-caption" aria-live="polite">
        {status !== 'ready' && status !== 'done' && beat.caption ? beat.say : ''}
      </p>

      <div className="explainer-controls">
        <button type="button" className="ctl" onClick={() => goScene(sceneIndex - 1)} disabled={sceneIndex === 0} aria-label="Prejšnji prizor">
          <Icon d={ICONS.prev} />
        </button>
        <button
          type="button"
          className="ctl ctl-play"
          onClick={toggle}
          aria-label={status === 'playing' ? 'Pavza' : 'Predvajaj'}
        >
          <Icon d={status === 'playing' ? ICONS.pause : ICONS.play} />
        </button>
        <button
          type="button"
          className="ctl"
          onClick={() => goScene(sceneIndex + 1)}
          disabled={sceneIndex === scenes.length - 1}
          aria-label="Naslednji prizor"
        >
          <Icon d={ICONS.next} />
        </button>

        <div className="ctl-progress" role="group" aria-label="Prizori">
          {scenes.map((s, i) => (
            <button
              key={i}
              type="button"
              className="ctl-seg"
              onClick={() => goScene(i)}
              aria-label={`Prizor ${i + 1} od ${scenes.length}`}
              aria-current={i === sceneIndex ? 'step' : undefined}
            >
              <span
                style={{ width: `${i < sceneIndex ? 100 : i === sceneIndex ? ((step + 1) / beats.length) * 100 : 0}%` }}
              />
            </button>
          ))}
        </div>

        {available && (
          <button
            type="button"
            className="ctl ctl-voice"
            onClick={() => setVoiceOn(v => !v)}
            aria-pressed={!voiceOn}
            aria-label={voiceOn ? 'Utišaj glas' : 'Vklopi glas'}
          >
            <Icon d={voiceOn ? ICONS.voiceOn : ICONS.voiceOff} />
          </button>
        )}
        <button type="button" className="ctl ctl-speed" onClick={cycleSpeed} aria-label={`Hitrost ${speedLabel}`}>
          {speedLabel}
        </button>
      </div>
    </div>
  );
}
