const SIZE = 132;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CreditRing({ balance, max }) {
  const fraction = max ? Math.min(balance / max, 1) : balance > 0 ? 1 : 0;
  const dash = fraction * CIRCUMFERENCE;

  return (
    <div className="credit-ring">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={max ? `Ostane ${balance} od ${max} kreditov` : `Na voljo ${balance} kreditov`}
      >
        <circle className="ring-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} />
        <circle
          className="ring-value"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="ring-center" aria-hidden="true">
        <span className="ring-number">{balance}</span>
        <span className="ring-caption">{max ? `od ${max}` : 'kreditov'}</span>
      </div>
    </div>
  );
}
