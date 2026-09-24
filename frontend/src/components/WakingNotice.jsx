import { useEffect, useState } from 'react';

export default function WakingNotice() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const onSlow = e => setSlow(e.detail.slow);
    window.addEventListener('snovko:slow-request', onSlow);
    return () => window.removeEventListener('snovko:slow-request', onSlow);
  }, []);

  if (!slow) return null;

  return (
    <div className="waking-notice" role="status">
      <span className="waking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      Strežnik se prebuja — prvi klic po daljšem premoru traja do pol minute.
    </div>
  );
}
