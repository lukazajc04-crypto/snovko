import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import useNarrator from '../hooks/useNarrator';
import useSfx from '../hooks/useSfx';
import Mascot from './Mascot';
import { SceneView, THINK_MS, hasChoice, sceneBeats } from './ExplainerScenes';
import '../styles/explainer.css';

const SPEEDS = [0.85, 1, 1.15];
// Vprašanje toliko časa čaka na klik, potem samo razkrije pravilni odgovor
const ANSWER_WAIT_MS = 20000;
// Pohvala ali popravek ostane na tabli, preden razlaga teče naprej
const FEEDBACK_MS = 1700;
const MOOD_MS = 2200;
// Najkrajši tihi WAV: predvajan med klikom odklene zvok na iPhonu za vse naslednje posnetke
const SILENT_WAV = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

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

// Predvaja posnetek ene povedi do konca; prekinitev ga ustavi. Po pavzi isti posnetek nadaljuje, kjer je ostal.
async function playClip(audio, url, rate, signal) {
  if (signal.aborted) return;
  if (audio.dataset.clip !== url || audio.ended) {
    audio.src = url;
    audio.dataset.clip = url;
  }
  audio.playbackRate = rate;
  await audio.play();
  await new Promise(resolve => {
    function done() {
      audio.removeEventListener('ended', done);
      audio.removeEventListener('error', done);
      signal.removeEventListener('abort', stop);
      resolve();
    }
    function stop() {
      audio.pause();
      done();
    }
    audio.addEventListener('ended', done);
    audio.addEventListener('error', done);
    signal.addEventListener('abort', stop);
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
  soundOn: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15 8.5a4.5 4.5 0 0 1 0 7M17.5 6a8 8 0 0 1 0 12',
  soundOff: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9.5l5 5M20.5 9.5l-5 5',
};

// Načini glasu: posnetki s strežnika (ElevenLabs ali Azure), glas naprave ali tiho s podnapisi
function narrationMode({ soundOn, serverVoice, audioFailed, deviceVoice }) {
  if (!soundOn) return 'silent';
  if (serverVoice && !audioFailed) return 'audio';
  return deviceVoice ? 'tts' : 'silent';
}

export default function AnimatedExplainer({ generationId, animation, serverVoice, title, onClose, onQuiz }) {
  const scenes = animation.prizori;
  const { available, speak, unlock } = useNarrator();
  const [soundOn, setSoundOn] = useState(true);
  const sfx = useSfx(soundOn);
  const [audio] = useState(() => new Audio());
  const [sceneIndex, setSceneIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('ready'); // ready | playing | paused | waiting | done
  const [talking, setTalking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [mood, setMood] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [audioFailed, setAudioFailed] = useState(false);
  const dialogRef = useRef(null);
  const startRef = useRef(null);
  const audioUrls = useRef(new Map());
  // Zanka predvajanja bere trenutni korak in odgovor brez ponovnega zagona ob vsaki spremembi
  const stepRef = useRef(step);
  stepRef.current = step;
  const answerRef = useRef(answer);
  answerRef.current = answer;

  const scene = scenes[sceneIndex];
  const beats = sceneBeats(scene);
  const beat = beats[Math.min(step, beats.length - 1)];
  const mode = narrationMode({ soundOn, serverVoice, audioFailed, deviceVoice: available });

  // Posnetek povedi prinese prijavljena zahteva (brskalnikov <audio> ne zna poslati žetona)
  const clipUrl = useCallback(
    (sceneAt, stepAt) => {
      const key = `${sceneAt}-${stepAt}`;
      if (!audioUrls.current.has(key)) {
        const request = api
          .get(`/api/generations/${generationId}/animation/audio/${sceneAt}/${stepAt}`, { responseType: 'blob' })
          .then(res => URL.createObjectURL(res.data));
        request.catch(() => audioUrls.current.delete(key));
        audioUrls.current.set(key, request);
      }
      return audioUrls.current.get(key);
    },
    [generationId]
  );

  // Naslednji dve povedi se pripravita vnaprej, da med koraki ni čakanja na strežnik
  const prefetch = useCallback(
    (sceneAt, stepAt) => {
      let found = 0;
      for (let s = sceneAt; s < scenes.length && found < 2; s++) {
        const koraki = scenes[s].koraki;
        for (let b = s === sceneAt ? stepAt : 0; b < koraki.length && found < 2; b++) {
          if (!koraki[b].govor) continue;
          clipUrl(s, b).catch(() => {});
          found += 1;
        }
      }
    },
    [scenes, clipUrl]
  );

  useEffect(() => {
    if (serverVoice) prefetch(0, 0);
  }, [serverVoice, prefetch]);

  useEffect(() => {
    const urls = audioUrls.current;
    return () => {
      audio.pause();
      urls.forEach(request => request.then(URL.revokeObjectURL, () => {}));
      // Preklicanih naslovov ne smemo ponovno uporabiti, če se razlaga znova odpre
      urls.clear();
    };
  }, [audio]);

  // Korak za korakom: glas prebere poved (posnetek ali glas naprave) ali počakamo čas branja,
  // nato premor iz scenarija
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    const current = scenes[sceneIndex];
    const currentBeat = sceneBeats(current)[step];

    (async () => {
      if (currentBeat.say && mode === 'audio') {
        prefetch(sceneIndex, step + 1);
        try {
          const url = await clipUrl(sceneIndex, step);
          setTalking(true);
          await playClip(audio, url, speed, signal);
        } catch {
          // Strežnik glasu ni dosegljiv: do konca razlage bere glas naprave
          if (!signal.aborted) setAudioFailed(true);
          return;
        } finally {
          setTalking(false);
        }
      } else if (currentBeat.say && mode === 'tts') {
        setTalking(true);
        await speak(currentBeat.say, speed, signal);
        setTalking(false);
      } else if (currentBeat.say) {
        await sleep(readingMs(currentBeat.say) / speed, signal);
      }
      if (signal.aborted) return;
      if (current.tip === 'vprasanje' && step === 0 && !answerRef.current) {
        setStatus('waiting');
        return;
      }
      await sleep(currentBeat.pause / speed, signal);
      if (signal.aborted) return;
      if (step < current.koraki.length - 1) setStep(step + 1);
      else if (sceneIndex < scenes.length - 1) {
        setSceneIndex(sceneIndex + 1);
        setStep(0);
      } else setStatus('done');
    })();

    return () => {
      controller.abort();
      setTalking(false);
    };
  }, [mode, status, sceneIndex, step, speed, scenes, speak, audio, clipUrl, prefetch]);

  // Vprašanje: brez klika po določenem času razkrije odgovor
  useEffect(() => {
    if (status !== 'waiting' || answer) return undefined;
    const timer = setTimeout(() => setAnswer({ choice: null }), hasChoice(scene) ? ANSWER_WAIT_MS : THINK_MS);
    return () => clearTimeout(timer);
  }, [status, answer, scene]);

  // Ko je odgovor izbran (ali razkrit), razlaga po kratkem odzivu teče naprej
  useEffect(() => {
    if (status !== 'waiting' || !answer) return undefined;
    const timer = setTimeout(
      () => {
        setStep(1);
        setStatus('playing');
      },
      answer.choice ? FEEDBACK_MS : 400
    );
    return () => clearTimeout(timer);
  }, [status, answer]);

  useEffect(() => {
    setAnswer(null);
  }, [sceneIndex]);

  useEffect(() => {
    if (!mood) return undefined;
    const timer = setTimeout(() => setMood(null), MOOD_MS);
    return () => clearTimeout(timer);
  }, [mood]);

  // Zvoki: nov element na tabli, brisanje table ob novem prizoru, fanfara na koncu
  const playingRef = useRef(false);
  playingRef.current = status === 'playing' || status === 'waiting';
  useEffect(() => {
    if (!playingRef.current) return undefined;
    const sound = sceneBeats(scenes[sceneIndex])[step]?.sound;
    return sound ? sfx.play(sound[0], sound[1] / speed) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIndex, step]);
  useEffect(() => {
    if (sceneIndex > 0 && playingRef.current) sfx.play('swish');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIndex]);
  useEffect(() => {
    if (status === 'done') sfx.play('tada');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    startRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Prvi dotik mora neposredno sprožiti zvok, sicer ga iPhone pozneje ne dovoli
  function unlockSound() {
    unlock();
    sfx.unlock();
    if (serverVoice) {
      audio.src = SILENT_WAV;
      audio.dataset.clip = '';
      audio.play().catch(() => {});
    }
  }

  function play() {
    if (status === 'ready' || status === 'done') unlockSound();
    if (status === 'done') {
      setSceneIndex(0);
      setStep(0);
      setAnswer(null);
    }
    setStatus('playing');
  }

  function toggle() {
    if (status === 'playing' || status === 'waiting') setStatus('paused');
    else play();
  }

  function goScene(index) {
    if (index < 0 || index >= scenes.length) return;
    if (status === 'ready') unlockSound();
    setSceneIndex(index);
    setStep(0);
    if (status !== 'paused') setStatus('playing');
  }

  function chooseAnswer(choice) {
    if (answer) return;
    setAnswer({ choice });
    if (choice === 'a') {
      sfx.play('ding');
      setMood('happy');
    } else {
      sfx.play('oops');
      setMood('oops');
    }
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

  const waitingForChoice = status === 'waiting' && hasChoice(scene) && !answer;
  const mascotMood =
    mood ??
    (status === 'ready'
      ? 'wave'
      : status === 'done'
        ? 'happy'
        : status === 'waiting' && !answer
          ? 'think'
          : talking
            ? 'talk'
            : 'idle');
  // Sova »govori« podnapise; ko na tabli že piše ista poved, pove kaj drugega ali molči
  let bubble = '';
  if (status === 'ready') bubble = 'Živjo! Klikni ▶ in začniva.';
  else if (status === 'done') bubble = 'Bravo! Zdaj pa preveri znanje še v kvizu.';
  else if (waitingForChoice) bubble = 'Kaj misliš? Klikni odgovor na tabli!';
  else if (beat.caption) bubble = beat.say;

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
        <div
          className={`board ${status === 'paused' ? 'is-paused' : ''}`}
          onClick={status === 'ready' || status === 'waiting' ? undefined : toggle}
        >
          <div className="board-scene" key={sceneIndex}>
            <SceneView
              scene={scene}
              step={step}
              waiting={status === 'waiting'}
              answer={answer}
              onAnswer={chooseAnswer}
            />
          </div>

          {status === 'ready' && (
            <div className="board-overlay">
              <button type="button" className="board-start" onClick={play} ref={startRef} aria-label="Začni razlago">
                <Icon d={ICONS.play} />
              </button>
              <p className="board-start-label">Začni razlago</p>
              {!serverVoice && !available && (
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

      <div className="explainer-narrator">
        <Mascot mood={mascotMood} />
        <p className={`explainer-bubble ${bubble ? 'has-text' : ''}`} aria-live="polite">
          {bubble}
        </p>
      </div>

      <div className="explainer-controls">
        <button type="button" className="ctl" onClick={() => goScene(sceneIndex - 1)} disabled={sceneIndex === 0} aria-label="Prejšnji prizor">
          <Icon d={ICONS.prev} />
        </button>
        <button
          type="button"
          className="ctl ctl-play"
          onClick={toggle}
          aria-label={status === 'playing' || status === 'waiting' ? 'Pavza' : 'Predvajaj'}
        >
          <Icon d={status === 'playing' || status === 'waiting' ? ICONS.pause : ICONS.play} />
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

        <button
          type="button"
          className="ctl ctl-sound"
          onClick={() => setSoundOn(on => !on)}
          aria-pressed={!soundOn}
          aria-label={soundOn ? 'Izklopi zvok' : 'Vklopi zvok'}
        >
          <Icon d={soundOn ? ICONS.soundOn : ICONS.soundOff} />
        </button>
        <button type="button" className="ctl ctl-speed" onClick={cycleSpeed} aria-label={`Hitrost ${speedLabel}`}>
          {speedLabel}
        </button>
      </div>
    </div>
  );
}
