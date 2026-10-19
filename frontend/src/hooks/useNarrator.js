import { useCallback, useEffect, useRef, useState } from 'react';

// Pripovedovalec animirane razlage: prebere eno poved in sporoči, kdaj je končal.
// Brez slovenskega glasu raje molči (razlaga teče s podnapisi), kot da bi bral s tujim naglasom.
export default function useNarrator() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voice, setVoice] = useState(null);
  // Chrome brez reference na utterance tega pospravi prezgodaj in onend se ne sproži
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    function pick() {
      const voices = synth.getVoices();
      setVoice(voices.find(v => v.lang === 'sl-SI') || voices.find(v => v.lang?.toLowerCase().startsWith('sl')) || null);
    }
    pick();
    synth.addEventListener('voiceschanged', pick);
    return () => {
      synth.removeEventListener('voiceschanged', pick);
      synth.cancel();
    };
  }, [supported]);

  // iOS dovoli govor šele po dotiku: prazna poved med klikom »odklene« sintezo za pozneje
  const unlock = useCallback(() => {
    if (supported) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  }, [supported]);

  const speak = useCallback(
    (text, rate, signal) =>
      new Promise(resolve => {
        if (!voice || signal.aborted) {
          resolve();
          return;
        }
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        utteranceRef.current = utterance;

        // Varovalka, če brskalnik konca ne sporoči (znana napaka pri dolgem branju v Chromu)
        const words = text.split(/\s+/).length;
        const fallback = setTimeout(done, (words * 650) / rate + 4000);
        function done() {
          clearTimeout(fallback);
          signal.removeEventListener('abort', stop);
          resolve();
        }
        function stop() {
          synth.cancel();
          done();
        }
        utterance.onend = done;
        utterance.onerror = done;
        signal.addEventListener('abort', stop);
        synth.speak(utterance);
      }),
    [voice]
  );

  return { available: Boolean(voice), speak, unlock };
}
