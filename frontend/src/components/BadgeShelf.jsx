import '../styles/badges.css';

// Preproste črtne ikone v slogu ostalih ikon v aplikaciji
const GLYPHS = {
  book: <path d="M4 5.5c3-1.2 5.5-1 8 .6 2.5-1.6 5-1.8 8-.6v12c-3-1.2-5.5-1-8 .6-2.5-1.6-5-1.8-8-.6v-12ZM12 6.1v12" />,
  flame: <path d="M12 3.5c.6 3-1 4.2-2.6 5.8C7.5 11.1 6.5 12.7 6.5 15a5.5 5.5 0 0 0 11 0c0-2-1-3.6-2.3-5.2-.8 1-1.5 1.4-2.2 1.4.9-2.6.6-5.3-1-7.7Z" />,
  star: <path d="m12 3.8 2.5 5.3 5.6.8-4 4.1.9 5.8-5-2.8-5 2.8.9-5.8-4-4.1 5.6-.8L12 3.8Z" />,
  rosette: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.6 7 20.5l5-2.4 5 2.4-1.5-6.9" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5.2-5.2 2 2-5.2 5.2-2Z" />
    </>
  ),
  check: (
    <>
      <path d="M6 4.5h12v15H6z" />
      <path d="m9 11.8 2.2 2.4 4-5" />
    </>
  ),
};

function BadgeIcon({ glyph }) {
  return (
    <svg className="badge-icon" viewBox="0 0 24 24" aria-hidden="true">
      {GLYPHS[glyph]}
    </svg>
  );
}

const FRESH_HOURS = 24;

// Značka je "nova" še dan po prislužitvi — preživi osvežitev strani,
// za razliko od enkratne zastavice s strežnika
function isFresh(earnedAt) {
  if (!earnedAt) return false;
  const earned = new Date(`${earnedAt.replace(' ', 'T')}Z`);
  return Date.now() - earned.getTime() < FRESH_HOURS * 3600 * 1000;
}

export default function BadgeShelf({ badges, compact = false }) {
  const { badges: list, earned_count: earnedCount, total } = badges;

  if (compact) {
    const earned = list.filter(b => b.earned);
    if (earned.length === 0) return <p className="hand-note">Še ni prisluženih značk.</p>;

    return (
      <ul className="badge-strip">
        {earned.map(b => (
          <li key={b.code} className="badge-chip" title={b.hint}>
            <BadgeIcon glyph={b.glyph} />
            {b.name}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="badge-shelf">
      <p className="badge-count">
        <strong>{earnedCount}</strong> od {total} značk
      </p>
      <ul className="badge-grid">
        {list.map((b, i) => {
          const fresh = b.earned && isFresh(b.earned_at);
          return (
          <li
            key={b.code}
            className={`badge ${b.earned ? 'is-earned' : 'is-locked'} ${fresh ? 'is-new' : ''}`}
            style={{ '--badge-tilt': `${(i % 3) - 1}deg` }}
          >
            {fresh && <span className="badge-new">novo!</span>}
            <BadgeIcon glyph={b.glyph} />
            <span className="badge-name">{b.name}</span>
            <span className="badge-hint">{b.hint}</span>
            {!b.earned && (
              <span className="badge-progress" aria-label={`Napredek ${b.progress} od ${b.goal}`}>
                {b.progress} / {b.goal}
              </span>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}
