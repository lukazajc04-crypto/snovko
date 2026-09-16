import { useState } from 'react';
import api, { errorMessage } from '../api';
import NoteCard from './NoteCard';

export default function LinkChildForm({ onLinked }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/api/children/link', { code });
      onLinked();
    } catch (err) {
      setError(errorMessage(err, 'Povezava ni uspela.'));
      setSaving(false);
    }
  }

  return (
    <NoteCard tilt={-0.8} className="link-card">
      <h2>Poveži se s staršem</h2>
      <p className="prose">Starš je ob prijavi dobil kodo iz šestih znakov. Vpiši jo sem, pa lahko začneš.</p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Koda od starša</span>
          <input
            required
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Na primer BPBT2D"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={6}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Povezujem…' : 'Poveži'}
        </button>
      </form>
    </NoteCard>
  );
}
