// Snovko: sova iz krede, ki pripoveduje razlago. Ko glas govori, odpira kljun; med vprašanjem
// razmišlja, ob pravilnem odgovoru in na koncu poskoči, ob napaki nagne glavo.
export default function Mascot({ mood }) {
  return (
    <div className={`mascot is-${mood}`} aria-hidden="true">
      <svg viewBox="0 0 120 132">
        <path className="m-line m-tuft" d="M33 31 24 10l19 12M87 31l9-21-19 12" />
        <path className="m-body" d="M60 19c-27 0-43 21-43 50 0 31 18 51 43 51s43-20 43-51c0-29-16-50-43-50Z" />
        <path className="m-belly" d="M60 64c-15 0-25 12-25 28s11 24 25 24 25-8 25-24-10-28-25-28Z" />
        <path className="m-faint" d="M49 86q5.5 4 11 0 5.5 4 11 0M45 98q7.5 5 15 0 7.5 5 15 0" />
        <path className="m-line m-wing-l" d="M20 68c-9 11-9 27 2 38" />
        <path className="m-line m-wing-r" d="M100 68c9 11 9 27-2 38" />
        <g className="m-eyes">
          <circle className="m-eye" cx="45" cy="51" r="12.5" />
          <circle className="m-eye" cx="75" cy="51" r="12.5" />
          <g className="m-pupils">
            <circle className="m-pupil" cx="46" cy="52" r="5.2" />
            <circle className="m-pupil" cx="74" cy="52" r="5.2" />
            <circle className="m-glint" cx="48" cy="49.5" r="1.6" />
            <circle className="m-glint" cx="76" cy="49.5" r="1.6" />
          </g>
        </g>
        <path className="m-line m-happy-eyes" d="M36 54q9-10 18 0M66 54q9-10 18 0" />
        <path className="m-beak-top" d="M53.5 62h13L60 70.5Z" />
        <path className="m-beak-bottom" d="M56 68.5h8L60 74Z" />
        <path className="m-line" d="M50 120v7M45.5 127h9M70 120v7M65.5 127h9" />
      </svg>
      {mood === 'think' && <span className="m-bubble">?</span>}
      {mood === 'happy' && <span className="m-spark">✦</span>}
    </div>
  );
}
