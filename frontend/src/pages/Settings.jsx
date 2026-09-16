import { useState } from 'react';
import NoteCard from '../components/NoteCard';
import '../styles/settings.css';

const TUTORIAL_KEYS = ['snovko_tutorial_done', 'snovko_parent_tutorial_done'];

export default function Settings() {
  const [done, setDone] = useState(false);

  function repeatTutorial() {
    TUTORIAL_KEYS.forEach(key => localStorage.removeItem(key));
    setDone(true);
  }

  return (
    <main className="page page-narrow settings-page">
      <p className="kicker">nastavitve →</p>
      <h1>Nastavitve</h1>

      <NoteCard tilt={-0.8}>
        <h2>Uvodni vodič</h2>
        <p className="prose">
          Ponovno prikaže vodič po pregledu za starše in po otroški strani, ob naslednjem obisku vsake od njiju.
        </p>
        <button type="button" className="btn btn-primary" onClick={repeatTutorial} disabled={done}>
          {done ? 'Vodič bo prikazan znova ✓' : 'Ponovi uvodni vodič'}
        </button>
        {done && (
          <p className="hand-note settings-note" role="status">
            Obišči /dashboard ali otrokov /child, da ga vidiš.
          </p>
        )}
      </NoteCard>
    </main>
  );
}
