const MAX_VISIBLE = 6;

function quizLabel(n) {
  const mod = n % 100;
  if (mod === 1) return `${n} kviz`;
  if (mod === 2) return `${n} kviza`;
  if (mod === 3 || mod === 4) return `${n} kvizi`;
  return `${n} kvizov`;
}

export default function SubjectBars({ subjects }) {
  if (subjects.length === 0) {
    return <p className="hand-note">Ko otrok reši prvi kviz, se tu pokaže razrez po predmetih.</p>;
  }

  const shown = subjects.slice(0, MAX_VISIBLE);

  return (
    <figure className="subject-bars">
      <ul className="subject-list">
        {shown.map(s => (
          <li key={s.subject} className="subject-row">
            <span className="subject-name">{s.subject}</span>
            <span className="subject-track">
              <span className="subject-fill" style={{ width: `${s.percent}%` }} />
            </span>
            <span className="subject-value">
              {s.percent} %<span className="subject-quizzes">{quizLabel(s.quizzes)}</span>
            </span>
          </li>
        ))}
      </ul>
      {subjects.length > MAX_VISIBLE && (
        <figcaption className="subject-more">+ še {subjects.length - MAX_VISIBLE} predmetov</figcaption>
      )}
    </figure>
  );
}
