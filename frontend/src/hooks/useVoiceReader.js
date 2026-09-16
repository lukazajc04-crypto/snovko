import { useCallback, useEffect, useRef, useState } from 'react';

export const RATE_STEPS = [0.75, 1, 1.25, 1.5];
const RATE_KEY = 'snovko-speech-rate';
const LANG = 'sl-SI';

function loadStoredRate() {
  const stored = Number(localStorage.getItem(RATE_KEY));
  return RATE_STEPS.includes(stored) ? stored : 1;
}

// Nekateri brskalniki (Firefox) ob 'boundary' ne pošljejo charLength, zato dolžino besede uganemo sami
function wordRangeAt(text, index, hintLength) {
  if (hintLength > 0) return { start: index, end: index + hintLength };
  const match = text.slice(index).match(/^\S+/);
  return { start: index, end: index + (match ? match[0].length : 1) };
}

export default function useVoiceReader(paragraphs) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [status, setStatus] = useState('idle'); // idle | playing | paused
  const [rate, setRateState] = useState(loadStoredRate);
  const [currentWord, setCurrentWord] = useState(null);
  const [progress, setProgress] = useState(0);
  const [voices, setVoices] = useState([]);
  const paragraphIndexRef = useRef(0);
  // Vsak (re)zagon branja dobi svoj ID, da pozni dogodki prekinjenega utterance-a (npr. ob spremembi
  // hitrosti mid-branja) ne morejo pomotoma prepisati stanja novo začete seje
  const sessionRef = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    function loadVoices() {
      const list = synth.getVoices();
      if (list.length) setVoices(list);
    }
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    return () => synth.removeEventListener('voiceschanged', loadVoices);
  }, [supported]);

  const totalLength = paragraphs.reduce((sum, p) => sum + p.length, 0) || 1;

  const speakFrom = useCallback(
    (startIndex, rateOverride) => {
      if (!supported || paragraphs.length === 0) return;
      const synth = window.speechSynthesis;
      const session = ++sessionRef.current;
      synth.cancel();

      const activeRate = rateOverride ?? rate;
      const voice = voices.find(v => v.lang === LANG) || voices.find(v => v.lang?.startsWith('sl')) || voices[0] || null;

      function speakParagraph(index) {
        if (session !== sessionRef.current) return;
        if (index >= paragraphs.length) {
          setStatus('idle');
          setCurrentWord(null);
          setProgress(0);
          paragraphIndexRef.current = 0;
          return;
        }
        paragraphIndexRef.current = index;
        const text = paragraphs[index];
        const before = paragraphs.slice(0, index).reduce((sum, p) => sum + p.length, 0);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = LANG;
        if (voice) utterance.voice = voice;
        utterance.rate = activeRate;

        utterance.onboundary = event => {
          if (session !== sessionRef.current) return;
          if (event.name && event.name !== 'word') return;
          const range = wordRangeAt(text, event.charIndex, event.charLength);
          setCurrentWord({ paragraphIndex: index, ...range });
          setProgress(Math.min(1, (before + range.start) / totalLength));
        };
        utterance.onend = () => {
          if (session === sessionRef.current) speakParagraph(index + 1);
        };
        utterance.onerror = () => {
          if (session !== sessionRef.current) return; // prejšnja, namerno prekinjena seja — ni prava napaka
          setStatus('idle');
          setCurrentWord(null);
        };

        synth.speak(utterance);
      }

      setStatus('playing');
      speakParagraph(startIndex);
    },
    [supported, paragraphs, voices, rate, totalLength]
  );

  const toggle = useCallback(() => {
    if (!supported) return;
    if (status === 'idle') speakFrom(0);
    else if (status === 'playing') {
      window.speechSynthesis.pause();
      setStatus('paused');
    } else {
      window.speechSynthesis.resume();
      setStatus('playing');
    }
  }, [supported, status, speakFrom]);

  const stop = useCallback(() => {
    if (!supported) return;
    sessionRef.current += 1;
    window.speechSynthesis.cancel();
    setStatus('idle');
    setCurrentWord(null);
    setProgress(0);
    paragraphIndexRef.current = 0;
  }, [supported]);

  // Menjava hitrosti med branjem: API ne podpira spremembe "on the fly", zato odstavek začnemo znova
  const setRate = useCallback(
    nextRate => {
      setRateState(nextRate);
      localStorage.setItem(RATE_KEY, String(nextRate));
      if (status !== 'idle') speakFrom(paragraphIndexRef.current, nextRate);
    },
    [status, speakFrom]
  );

  // Ob zamenjavi besedila (nova stran, drugo gradivo) prekini branje
  useEffect(() => stop, [paragraphs, stop]);
  useEffect(() => () => supported && window.speechSynthesis.cancel(), [supported]);

  return { supported, status, rate, setRate, currentWord, progress, toggle, steps: RATE_STEPS };
}
