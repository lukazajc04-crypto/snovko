import { useEffect, useState } from 'react';

const MATERIAL_MESSAGES = ['Claude bere snov…', 'Pišem razlago…', 'Pripravljam kartončke…', 'Pripravljam kviz…', 'Skoraj gotovo…'];

export default function GeneratingNote({ messages = MATERIAL_MESSAGES, interval = 3000 }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex(i => Math.min(i + 1, messages.length - 1)), interval);
    return () => clearInterval(timer);
  }, [messages, interval]);

  return (
    <div className="generating" role="status" aria-live="polite">
      <span className="generating-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <p>{messages[index]}</p>
    </div>
  );
}
