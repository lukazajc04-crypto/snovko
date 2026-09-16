import NoteCard from './NoteCard';

const RATE_LABELS = { 0.75: '0,75×', 1: '1×', 1.25: '1,25×', 1.5: '1,5×' };

export default function VoiceReaderCard({ supported, status, rate, setRate, progress, toggle, steps }) {
  const stepIndex = steps.indexOf(rate);

  return (
    <NoteCard tilt={0.7} as="section" className="voice-reader">
      <p className="voice-reader-title">glasovno branje</p>

      {!supported ? (
        <p className="hand-note">Tvoj brskalnik žal ne podpira glasovnega branja.</p>
      ) : (
        <>
          <div className="voice-reader-controls">
            <button type="button" className="btn btn-primary voice-toggle" onClick={toggle}>
              {status === 'playing' ? '⏸ Pavza' : status === 'paused' ? '▶ Nadaljuj' : '▶ Poslušaj razlago'}
            </button>

            <label className="voice-rate">
              <span className="voice-rate-label">hitrost {RATE_LABELS[rate]}</span>
              <input
                type="range"
                min={0}
                max={steps.length - 1}
                step={1}
                value={stepIndex}
                onChange={e => setRate(steps[Number(e.target.value)])}
                aria-label="Hitrost branja"
                aria-valuetext={RATE_LABELS[rate]}
              />
            </label>
          </div>

          <div
            className="voice-progress"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Napredek branja"
          >
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        </>
      )}
    </NoteCard>
  );
}
