import { Link } from 'react-router-dom';

// Barve sledijo grafu tedna: gradiva modra, kvizi rdeča, pregledi vijolična
const TYPES = {
  gradivo: {
    label: 'Novo gradivo',
    icon: <path d="M7 3.5h7.5L19 8v12.5H7zM14.5 3.5V8H19M10 12.5h6M10 16h4" />,
  },
  kviz: {
    label: 'Kviz',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 12.3l2.4 2.4 4.6-4.9" />
      </>
    ),
  },
  pregled: {
    label: 'Pregledan list',
    icon: <path d="M15.5 4.5l4 4L9 19H5v-4zM13 7l4 4" />,
  },
};

const toDate = sqliteDate => new Date(`${sqliteDate.replace(' ', 'T')}Z`);
const dayKey = date => date.toLocaleDateString('sv-SE');

function dayHeading(date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(date) === dayKey(new Date())) return 'Danes';
  if (dayKey(date) === dayKey(yesterday)) return 'Včeraj';
  return date.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupByDay(activity) {
  const groups = [];
  for (const a of activity) {
    const date = toDate(a.created_at);
    const key = dayKey(date);
    const item = { ...a, date };
    if (groups.at(-1)?.key === key) groups.at(-1).items.push(item);
    else groups.push({ key, heading: dayHeading(date), items: [item] });
  }
  return groups;
}

export default function ActivityTimeline({ activity }) {
  if (activity.length === 0) {
    return <p className="hand-note">Tu se bo pokazalo vse, kar se otrok nauči v Snovku.</p>;
  }

  return (
    <div className="timeline">
      {groupByDay(activity).map(group => (
        <section key={group.key} className="timeline-day">
          <h3 className="timeline-heading">{group.heading}</h3>
          <ol className="timeline-list">
            {group.items.map(a => {
              const type = TYPES[a.type];
              return (
                <li key={`${a.type}-${a.generation_id ?? a.check_id}-${a.created_at}`} className={`timeline-item is-${a.type}`}>
                  <span className="timeline-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">{type.icon}</svg>
                  </span>
                  <Link
                    to={a.type === 'pregled' ? `/checks/${a.check_id}` : `/results/${a.generation_id}`}
                    className="timeline-card"
                  >
                    <span className="timeline-top">
                      <span className="timeline-type">{type.label}</span>
                      <time dateTime={a.created_at}>
                        {a.date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </span>
                    <span className="timeline-title">{a.naslov || 'Brez naslova'}</span>
                    <span className="timeline-subject">{a.subject}</span>
                    {a.score !== null && (
                      <span className={`score-chip ${a.score === a.total ? 'is-full' : ''}`}>
                        {a.score}/{a.total}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
