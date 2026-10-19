const dayShort = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('sl-SI', { weekday: 'short' }).replace('.', '');
const dayLong = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'numeric' });

export const isActiveDay = d => (d.gradiva ?? 0) + (d.kvizi ?? 0) + (d.pregledi ?? 0) > 0;

// Sedem žigov za zadnji teden — dan z učenjem dobi kljukico, brez učenja ostane prazen krog
export default function StreakDots({ week }) {
  const lastIndex = week.length - 1;

  return (
    <ol className="streak-dots">
      {week.map((d, i) => {
        const active = isActiveDay(d);
        const isToday = i === lastIndex;
        return (
          <li
            key={d.day}
            className={`streak-day ${active ? 'is-active' : ''} ${isToday ? 'is-today' : ''}`}
            style={{ '--i': i }}
          >
            <span className="streak-stamp" aria-hidden="true">
              {active && (
                <svg viewBox="0 0 24 24">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </span>
            <span className="streak-name" aria-hidden="true">
              {isToday ? 'danes' : dayShort(d.day)}
            </span>
            <span className="visually-hidden">
              {dayLong(d.day)}: {active ? 'z učenjem' : 'brez učenja'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
