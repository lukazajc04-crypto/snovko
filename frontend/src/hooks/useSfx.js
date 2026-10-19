import { useCallback, useEffect, useRef } from 'react';

// Kratki zvočni učinki animirane razlage, sintetizirani v brskalniku (brez zvočnih datotek).
// Glasnost je nizka: učinki naj podprejo razlago, ne preglasijo glasu.

function tone(ctx, { freq, to = freq, start = 0, duration = 0.12, type = 'sine', gain = 0.08 }) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Šum skozi pasovni filter: zveni kot gobica, ki podrsa po tabli
function swish(ctx) {
  const duration = 0.32;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2600, ctx.currentTime + duration);
  amp.gain.value = 0.05;
  source.connect(filter).connect(amp).connect(ctx.destination);
  source.start();
}

const SOUNDS = {
  pop: ctx => tone(ctx, { freq: 520, to: 880, duration: 0.09, gain: 0.07 }),
  tick: ctx => tone(ctx, { freq: 1300, duration: 0.05, type: 'triangle', gain: 0.04 }),
  draw: ctx => tone(ctx, { freq: 300, to: 760, duration: 0.9, type: 'triangle', gain: 0.03 }),
  ding: ctx => {
    tone(ctx, { freq: 880, duration: 0.5, gain: 0.07 });
    tone(ctx, { freq: 1320, start: 0.09, duration: 0.6, gain: 0.06 });
  },
  oops: ctx => tone(ctx, { freq: 330, to: 220, duration: 0.3, type: 'triangle', gain: 0.06 }),
  tada: ctx => [523, 659, 784, 1047].forEach((freq, i) => tone(ctx, { freq, start: i * 0.11, duration: 0.45, gain: 0.06 })),
  swish,
};

export default function useSfx(enabled) {
  const ctxRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Brskalniki dovolijo zvok šele po dotiku, zato kontekst ustvarimo ob kliku na »začni«
  const unlock = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    ctxRef.current.resume?.();
  }, []);

  const play = useCallback((name, delayMs = 0) => {
    const ctx = ctxRef.current;
    if (!ctx || !SOUNDS[name]) return undefined;
    const timer = setTimeout(() => {
      if (enabledRef.current && ctx.state === 'running') SOUNDS[name](ctx);
    }, delayMs);
    return () => clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      ctxRef.current?.close?.();
      ctxRef.current = null;
    },
    []
  );

  return { unlock, play };
}
