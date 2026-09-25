import { useRef, useState } from 'react';
import { creditsForText } from '../constants';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_SIDE = 2000;
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

const VARIANTS = {
  material: {
    extensions: ['.pdf', '.docx', '.jpg', '.jpeg', '.png', '.txt'],
    accept: '.pdf,.docx,.jpg,.jpeg,.png,.txt,image/jpeg,image/png',
    title: 'Povleci zvezek ali delovni list sem',
    hint: 'fotografija, PDF, Word ali besedilo',
    pick: 'Izberi fotografijo ali datoteko',
    submit: 'Ustvari gradivo · od 2 kreditov',
    typeError: 'Podprte so datoteke PDF, DOCX, JPG, PNG in TXT.',
    allowText: true,
  },
  worksheet: {
    extensions: IMAGE_EXTENSIONS,
    accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
    title: 'Fotografiraj rešen učni list',
    hint: 'celo stran, od blizu in pri dobri svetlobi',
    pick: 'Izberi fotografijo',
    submit: 'Preglej list · 2 kredita',
    typeError: 'Za pregled naloži fotografijo (JPG ali PNG).',
    allowText: false,
  },
};

const extensionOf = name => name.slice(name.lastIndexOf('.')).toLowerCase();
const isImage = file => IMAGE_EXTENSIONS.includes(extensionOf(file.name));

// Fotografije s telefona so pogosto večje od 5 MB, kolikor jih sprejme AI. Ponovno kodiranje
// poravna tudi zasuk iz EXIF, da se oznake pri pregledu ujemajo s tem, kar vidi otrok.
async function normalizeImage(file, force) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  if (!force && scale === 1 && file.size < 1.5 * 1024 * 1024) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

export default function UploadZone({ onSubmit, disabled, variant = 'material' }) {
  const config = VARIANTS[variant];
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState('file');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  function pickFile(candidate) {
    setError('');
    if (!candidate) return;
    if (!config.extensions.includes(extensionOf(candidate.name))) {
      setError(config.typeError);
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError('Datoteka je prevelika (največ 10 MB).');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(isImage(candidate) ? URL.createObjectURL(candidate) : null);
    setFile(candidate);
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) pickFile(e.dataTransfer.files[0]);
  }

  async function handleSubmit() {
    setError('');
    if (mode === 'text') {
      if (text.trim().length < 30) {
        setError('Prilepi vsaj nekaj stavkov snovi.');
        return;
      }
      onSubmit({ text: text.trim() });
      return;
    }
    try {
      onSubmit({ file: isImage(file) ? await normalizeImage(file, variant === 'worksheet') : file });
    } catch {
      setError('Fotografije ni bilo mogoče odpreti. Poskusi z drugo.');
    }
  }

  const ready = mode === 'file' ? Boolean(file) : text.trim().length > 0;

  // Cena gradiva je vezana na dolžino: besedilo poznamo takoj, datoteko šele strežnik prebere
  const pastedCredits = mode === 'text' ? creditsForText(text.trim().length) : null;
  const submitLabel =
    variant !== 'material'
      ? config.submit
      : pastedCredits !== null
        ? `Ustvari gradivo · ${pastedCredits} kredite`
        : file && isImage(file)
          ? 'Ustvari gradivo · 2 kredita'
          : config.submit;

  return (
    <div
      className={`upload-zone ${dragging ? 'is-dragging' : ''}`}
      onDragOver={e => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {mode === 'file' ? (
        <>
          {preview ? (
            <img className="upload-preview" src={preview} alt="Izbrana fotografija" />
          ) : (
            <svg className="upload-icon" viewBox="0 0 48 48" aria-hidden="true">
              {variant === 'worksheet' ? (
                <>
                  <path d="M12 6h24v36H12z" />
                  <path d="M17 15l2.5 2.5L24 13M17 25l2.5 2.5L24 23M28 15h4M28 25h4M17 34h15" />
                </>
              ) : (
                <>
                  <path d="M12 6h17l9 9v27H12z" />
                  <path d="M29 6v9h9M25 36V22M19 28l6-6 6 6" />
                </>
              )}
            </svg>
          )}
          {file ? (
            <p className="upload-title">
              <span className="upload-file">{file.name}</span>
              <button type="button" className="link-button" onClick={clearFile} disabled={disabled}>
                zamenjaj
              </button>
            </p>
          ) : (
            <>
              <p className="upload-title">{config.title}</p>
              <p className="upload-hint">{config.hint}</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={config.accept}
            hidden
            onChange={e => {
              pickFile(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </>
      ) : (
        <label className="upload-text">
          <span className="upload-title">Prilepi snov</span>
          <textarea
            rows={7}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Na primer odstavek iz učbenika ali zapiske iz šole…"
            disabled={disabled}
          />
        </label>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {variant === 'material' && (pastedCredits ?? 2) > 2 && (
        <p className="hand-note">Daljša snov porabi več kreditov: 2 kredita na vsako stran.</p>
      )}

      <div className="upload-actions">
        {mode === 'file' && !file && (
          <button type="button" className="btn" onClick={() => inputRef.current.click()} disabled={disabled}>
            {config.pick}
          </button>
        )}
        {ready && (
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={disabled}>
            {submitLabel}
          </button>
        )}
      </div>

      {config.allowText && (
        <button
          type="button"
          className="link-button upload-switch"
          onClick={() => {
            setMode(m => (m === 'file' ? 'text' : 'file'));
            setError('');
          }}
          disabled={disabled}
        >
          {mode === 'file' ? 'ali prilepi besedilo' : 'ali naloži fotografijo ali datoteko'}
        </button>
      )}
    </div>
  );
}
