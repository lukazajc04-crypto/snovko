import { useState } from 'react';

const SERIES = [
  { key: 'gradiva', label: 'gradiva', className: 'bar-gradiva', forms: ['gradivo', 'gradivi', 'gradiva', 'gradiv'] },
  { key: 'kvizi', label: 'rešeni kvizi', className: 'bar-kvizi', forms: ['kviz', 'kviza', 'kvizi', 'kvizov'] },
  { key: 'pregledi', label: 'pregledani listi', className: 'bar-pregledi', forms: ['pregled', 'pregleda', 'pregledi', 'pregledov'] },
];

const dayName = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('sl-SI', { weekday: 'short' }).replace('.', '');
const dayDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'numeric' });

function countLabel(n, [one, two, few, many]) {
  const mod = n % 100;
  if (mod === 1) return `${n} ${one}`;
  if (mod === 2) return `${n} ${two}`;
  if (mod === 3 || mod === 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

export default function WeekChart({ week }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(1, ...week.flatMap(d => SERIES.map(s => d[s.key] ?? 0)));
  const lastIndex = week.length - 1;

  return (
    <figure className="week-chart">
      <div className="chart-legend">
        {SERIES.map(s => (
          <span key={s.key} className="legend-item">
            <span className={`legend-swatch ${s.className}`} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>

      <div className="chart-plot" aria-hidden="true">
        <span className="chart-tick chart-tick-max">{max}</span>
        <span className="chart-tick chart-tick-zero">0</span>
        <div className="chart-days">
          {week.map((d, i) => (
            <div
              key={d.day}
              className={`chart-day ${hovered === i ? 'is-hovered' : ''}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="chart-bars">
                {SERIES.map(s => (
                  <span
                    key={s.key}
                    className={`chart-bar ${s.className} ${(d[s.key] ?? 0) === 0 ? 'is-zero' : ''}`}
                    style={{ height: `${((d[s.key] ?? 0) / max) * 100}%` }}
                  />
                ))}
              </div>
              <span className={`chart-label ${i === lastIndex ? 'is-today' : ''}`}>
                {i === lastIndex ? 'danes' : dayName(d.day)}
              </span>
              {hovered === i && (
                <span className="chart-tooltip">
                  <strong>{dayDate(d.day)}</strong>
                  {SERIES.map(s => (
                    <span key={s.key} className="tooltip-row">
                      <span className={`legend-swatch ${s.className}`} aria-hidden="true" />
                      {countLabel(d[s.key] ?? 0, s.forms)}
                    </span>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tabela za bralnike zaslona; ovita v blok, ker se <table> ne da skrčiti s width:1px */}
      <div className="visually-hidden">
        <table>
          <caption>Aktivnost v zadnjih 7 dneh</caption>
          <thead>
            <tr>
              <th scope="col">Dan</th>
              {SERIES.map(s => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.map(d => (
              <tr key={d.day}>
                <th scope="row">{dayDate(d.day)}</th>
                {SERIES.map(s => (
                  <td key={s.key}>{d[s.key] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
