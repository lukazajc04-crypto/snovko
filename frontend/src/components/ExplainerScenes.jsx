import { Fragment, useEffect, useState } from 'react';

// Prizori animirane razlage. Vsak prizor dobi `step` (do katerega koraka je razlaga prišla) in pokaže
// elemente do vključno tega koraka; nov element se ob prikazu sam animira, ker se šele takrat vstavi.

const WORD_MS = 75;
const QUESTION_HOLD_MS = 3500;
const TITLE_HOLD_MS = 900;

export const writeTime = text => String(text).split(/\s+/).filter(Boolean).length * WORD_MS;
const hasPair = k => Boolean(k.a && k.b);

const normalizeWord = w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function findPhrase(words, phrase) {
  const target = phrase.split(/\s+/).map(normalizeWord).filter(Boolean);
  if (target.length === 0) return null;
  const norm = words.map(normalizeWord);
  for (let i = 0; i + target.length <= norm.length; i++) {
    if (target.every((t, j) => norm[i + j] === t)) return [i, i + target.length - 1];
  }
  return null;
}

// Besedilo se na tablo »napiše« beseda za besedo; poudarek dobi podčrtaj s kredo, ko je izpisan
export function ChalkWords({ text, delay = 0, highlight = '' }) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const range = highlight ? findPhrase(words, highlight) : null;
  const run = (from, to) =>
    words.slice(from, to).map((w, j) => (
      <Fragment key={from + j}>
        {j > 0 && ' '}
        <span className="cw" style={{ animationDelay: `${delay + (from + j) * WORD_MS}ms` }}>
          {w}
        </span>
      </Fragment>
    ));

  if (!range) return <>{run(0, words.length)}</>;
  const [start, end] = range;
  return (
    <>
      {run(0, start)}
      {start > 0 && ' '}
      <span className="chalk-hl" style={{ '--hl-delay': `${delay + (end + 1) * WORD_MS + 150}ms` }}>
        {run(start, end + 1)}
      </span>
      {end + 1 < words.length && ' '}
      {run(end + 1, words.length)}
    </>
  );
}

// Števila na tabli v slovenskem zapisu (decimalna vejica), z enakim številom decimalk kot v snovi
function parseNumber(s) {
  const m = String(s).replace(/(\d)\s+(?=\d)/g, '$1').trim().replace(/−/g, '-').match(/^-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : NaN;
}
const decimalsOf = s => String(s).match(/^\s*-?\d+[.,](\d+)/)?.[1].length ?? 0;
const formatNumber = (value, decimals = 0) =>
  value.toLocaleString('sl-SI', { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 3) });

function Heading({ text }) {
  if (!text) return null;
  return (
    <h3 className="chalk-heading">
      <ChalkWords text={text} />
    </h3>
  );
}

const Star = ({ className }) => (
  <svg className={`doodle ${className}`} viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 3 2.4 5.6 6 .6-4.6 4 1.4 6-5.2-3.2-5.2 3.2 1.4-6-4.6-4 6-.6z" />
  </svg>
);

function TitleScene({ scene }) {
  return (
    <div className="scene scene-title">
      <Star className="d1" />
      <Star className="d2" />
      <svg className="doodle d3" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12c0-1.5 1.5-2.5 3-1.5s1.5 4-1.5 4.5-5.5-1.5-5-5 4.5-5.5 8-3.5 4 7.5 1 9.5" />
      </svg>
      {scene.podnaslov && (
        <p className="chalk-kicker">
          <ChalkWords text={scene.podnaslov} />
        </p>
      )}
      <h2 className="chalk-title">
        <ChalkWords text={scene.naslov} delay={350} />
      </h2>
      <svg className="chalk-swoosh" viewBox="0 0 400 24" aria-hidden="true">
        <path d="M8 16C110 4 260 4 392 13" pathLength="1" />
      </svg>
    </div>
  );
}

function TextScene({ scene, step }) {
  return (
    <div className="scene">
      <Heading text={scene.naslov} />
      <ul className="chalk-lines">
        {scene.koraki.slice(0, step + 1).map((k, i) => (
          <li key={i} className={i < step ? 'is-past' : ''}>
            <ChalkWords text={k.govor} highlight={k.a} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConceptScene({ scene, step }) {
  return (
    <div className="scene">
      <h3 className="chalk-term">
        <ChalkWords text={scene.naslov} />
        <svg className="term-box" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <rect x="2" y="2" width="96" height="36" rx="5" pathLength="1" />
        </svg>
      </h3>
      <ul className="chalk-lines">
        {scene.koraki.slice(0, step + 1).map((k, i) => (
          <li key={i} className={i < step ? 'is-past' : ''}>
            <ChalkWords text={k.a || k.govor} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalcScene({ scene, step }) {
  const firstPair = scene.koraki.findIndex(hasPair);
  return (
    <div className="scene">
      <Heading text={scene.naslov} />
      <div className="calc-board">
        {scene.koraki.slice(0, step + 1).map((k, i) => {
          if (!hasPair(k)) {
            return (
              <p key={i} className={firstPair === -1 || i < firstPair ? 'calc-task' : 'calc-answer'}>
                <ChalkWords text={k.govor} />
              </p>
            );
          }
          const written = writeTime(k.a);
          return (
            <p key={i} className="calc-row">
              <span>
                <ChalkWords text={k.a} />
              </span>
              <span className="calc-eq cw" style={{ animationDelay: `${written + 100}ms` }}>
                =
              </span>
              <span className="calc-result" style={{ '--pop': `${written + 350}ms` }}>
                {k.b}
                <svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
                  <ellipse cx="50" cy="25" rx="47" ry="21" pathLength="1" />
                </svg>
              </span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

function TableScene({ scene, step }) {
  const { podatki } = scene;
  const columns = scene.koraki.map((k, i) => ({ ...k, i })).filter(hasPair);
  const showRule = step > (columns.at(-1)?.i ?? Infinity);
  const decimals = Math.max(0, ...columns.map(c => decimalsOf(c.b)));

  return (
    <div className="scene">
      <Heading text={scene.naslov} />
      <div className="chalk-table" style={{ '--cols': columns.length }}>
        {/* Notranji span: v flex celici bi se presledki med besedami izgubili */}
        <span className="ct-label">
          <span>
            <ChalkWords text={podatki.oznaka_x} />
          </span>
        </span>
        <span className="ct-label">
          <span>
            <ChalkWords text={podatki.oznaka_y} delay={300} />
          </span>
        </span>
        {columns.map(c => (
          <Fragment key={c.i}>
            <span className="ct-cell">{c.i <= step && <span className="ct-value">{c.a}</span>}</span>
            <span className="ct-cell">
              {c.i <= step && (
                <span className="ct-value is-y" style={{ animationDelay: '300ms' }}>
                  {c.b}
                </span>
              )}
            </span>
          </Fragment>
        ))}
      </div>
      {showRule && (
        <p className="chalk-rule">
          {podatki.odnos === 'premo' && (
            <span className="rule-factor">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v15M6 13l6 6 6-6" />
              </svg>
              · {formatNumber(podatki.koeficient, decimals)}
            </span>
          )}
          {podatki.odnos === 'obratno' && (
            <span className="rule-factor">zgoraj · spodaj = {formatNumber(podatki.koeficient)}</span>
          )}
          {podatki.enacba && (
            <span className="rule-equation">
              <ChalkWords text={podatki.enacba} delay={400} />
            </span>
          )}
        </p>
      )}
    </div>
  );
}

// Graf ima na pokončni tabli (telefon) višje platno, sicer bi bil droben trak sredi table
const GRAPH_SIZE = { landscape: [480, 300], portrait: [360, 430] };
const PAD = { l: 58, r: 30, t: 34, b: 46 };

function useMatchMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function niceStep(max) {
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function axis(max) {
  if (!(max > 0)) return { top: 1, ticks: [1] };
  const step = max <= 10 && Number.isInteger(max) ? 1 : niceStep(max);
  const top = Math.max(step, Math.ceil((max * 1.08) / step) * step);
  const ticks = [];
  for (let v = step; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { top, ticks };
}

function GraphScene({ scene, step }) {
  const { podatki } = scene;
  const [GW, GH] = GRAPH_SIZE[useMatchMedia('(orientation: portrait)') ? 'portrait' : 'landscape'];
  const points = scene.koraki
    .map((k, i) => ({ x: parseNumber(k.a), y: parseNumber(k.b), i, pair: hasPair(k) }))
    .filter(p => p.pair && Number.isFinite(p.x) && Number.isFinite(p.y));
  const showLine = step > (points.at(-1)?.i ?? Infinity);

  const xAxis = axis(Math.max(...points.map(p => p.x)));
  const yAxis = axis(Math.max(...points.map(p => p.y)));
  const sx = x => PAD.l + (x / xAxis.top) * (GW - PAD.l - PAD.r);
  const sy = y => GH - PAD.b - (y / yAxis.top) * (GH - PAD.t - PAD.b);

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const throughOrigin = podatki.odnos === 'premo' && sorted[0]?.x !== 0;
  const linePoints = throughOrigin ? [{ x: 0, y: 0 }, ...sorted] : sorted;
  const linePath = linePoints.map((p, j) => `${j ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join(' ');
  const last = sorted.at(-1);

  return (
    <div className="scene">
      <Heading text={scene.naslov} />
      <svg
        className="chalk-graph"
        viewBox={`0 0 ${GW} ${GH}`}
        role="img"
        aria-label={`Graf: ${podatki.oznaka_y} glede na ${podatki.oznaka_x}`}
      >
        <g className="g-grid">
          {yAxis.ticks.map(v => (
            <g key={`y${v}`}>
              <line x1={PAD.l} x2={GW - PAD.r} y1={sy(v)} y2={sy(v)} />
              <text className="g-tick" x={PAD.l - 10} y={sy(v) + 5} textAnchor="end">
                {formatNumber(v)}
              </text>
            </g>
          ))}
          {xAxis.ticks.map(v => (
            <g key={`x${v}`}>
              <line x1={sx(v)} x2={sx(v)} y1={PAD.t} y2={GH - PAD.b} />
              <text className="g-tick" x={sx(v)} y={GH - PAD.b + 22} textAnchor="middle">
                {formatNumber(v)}
              </text>
            </g>
          ))}
        </g>
        <path className="g-axis" d={`M${PAD.l},${GH - PAD.b}H${GW - PAD.r + 12}`} pathLength="1" />
        <path className="g-axis" d={`M${PAD.l},${GH - PAD.b}V${PAD.t - 14}`} pathLength="1" />
        <path className="g-arrow" d={`M${GW - PAD.r + 4},${GH - PAD.b - 6}l8,6l-8,6M${PAD.l - 6},${PAD.t - 6}l6,-8l6,8`} />
        <text className="g-tick" x={PAD.l - 10} y={GH - PAD.b + 22} textAnchor="end">
          0
        </text>
        <text className="g-label" x={GW - PAD.r + 10} y={GH - 4} textAnchor="end">
          {podatki.oznaka_x}
        </text>
        <text className="g-label" x={PAD.l + 12} y={PAD.t - 12}>
          {podatki.oznaka_y}
        </text>

        {showLine && <path className="g-line" d={linePath} pathLength="1" />}
        {points
          .filter(p => p.i <= step)
          .map(p => (
            <g key={p.i} className={`g-point ${p.i === step ? 'is-current' : ''}`}>
              <path className="g-guide" d={`M${sx(p.x)},${sy(p.y)}V${GH - PAD.b}M${sx(p.x)},${sy(p.y)}H${PAD.l}`} />
              <circle cx={sx(p.x)} cy={sy(p.y)} r="6.5" />
            </g>
          ))}
        {showLine && podatki.enacba && last && (
          <text className="g-equation" x={sx(last.x) - 12} y={Math.max(PAD.t + 18, sy(last.y) - 16)} textAnchor="end">
            {podatki.enacba}
          </text>
        )}
      </svg>
    </div>
  );
}

function CompareScene({ scene, step }) {
  const { podatki } = scene;
  return (
    <div className="scene">
      <Heading text={scene.naslov} />
      <div className="compare-grid">
        <span className="compare-head">
          <ChalkWords text={podatki.oznaka_x} />
        </span>
        <span className="compare-vs" aria-hidden="true">
          ali
        </span>
        <span className="compare-head">
          <ChalkWords text={podatki.oznaka_y} delay={250} />
        </span>
        {scene.koraki.slice(0, step + 1).map(
          (k, i) =>
            (k.a || k.b) && (
              <Fragment key={i}>
                <span className="compare-cell">
                  <ChalkWords text={k.a} />
                </span>
                <span className="compare-mid" aria-hidden="true">
                  ↔
                </span>
                <span className="compare-cell">
                  <ChalkWords text={k.b} delay={writeTime(k.a) + 150} />
                </span>
              </Fragment>
            )
        )}
      </div>
    </div>
  );
}

function StepLabel({ item }) {
  return (
    <>
      {item.a && (
        <span className="step-title">
          <ChalkWords text={item.a} />
        </span>
      )}
      {item.b && (
        <span className="step-desc">
          <ChalkWords text={item.b} delay={writeTime(item.a)} />
        </span>
      )}
    </>
  );
}

function Sequence({ items, step }) {
  return (
    <ol className={`seq ${items.length > 4 ? 'is-list' : 'is-row'}`}>
      {items.map((item, n) => (
        <li key={item.i} className={item.i <= step ? 'is-on' : ''}>
          {item.i <= step && (
            <>
              <span className="seq-num">{n + 1}</span>
              <span className="seq-text">
                <StepLabel item={item} />
              </span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

function Timeline({ items, step }) {
  return (
    <ol className="tl">
      {items.map((item, n) => {
        const label = item.i <= step && <StepLabel item={item} />;
        return (
          <li key={item.i} className="tl-event">
            <span className="tl-top">{n % 2 === 0 && label}</span>
            <span className={`tl-dot ${item.i <= step ? 'is-on' : ''}`} />
            <span className="tl-bottom">{n % 2 === 1 && label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Cycle({ items, step }) {
  const n = items.length;
  const at = (k, radius) => {
    const angle = ((-90 + (k * 360) / n) * Math.PI) / 180;
    return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
  };
  return (
    <div className="cycle">
      <svg className="cycle-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="33" />
        {items.map((item, k) => {
          const mid = -90 + ((k + 0.5) * 360) / n;
          const p = at(k + 0.5, 33);
          return (
            item.i < step && (
              <path key={item.i} className="cycle-arrow" d="M-2.5,-3L1,0L-2.5,3" transform={`translate(${p.x} ${p.y}) rotate(${mid + 90})`} />
            )
          );
        })}
      </svg>
      {items.map((item, k) => {
        const p = at(k, 36);
        return (
          <div key={item.i} className="cycle-item" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            {item.i <= step && <StepLabel item={item} />}
          </div>
        );
      })}
    </div>
  );
}

function StepsScene({ scene, step }) {
  const items = scene.koraki.map((k, i) => ({ ...k, i })).filter(k => k.a || k.b);
  const Layout = { cikel: Cycle, casovnica: Timeline }[scene.podatki?.oblika] ?? Sequence;
  return (
    <div className="scene">
      <Heading text={scene.naslov} />
      <Layout items={items} step={step} />
    </div>
  );
}

function QuestionScene({ scene, step, holding }) {
  const [question, answer] = scene.koraki;
  return (
    <div className="scene scene-question">
      <span className="q-mark" aria-hidden="true">
        ?
      </span>
      <p className="chalk-question">
        <ChalkWords text={question.govor} />
      </p>
      {step === 0 && holding && (
        <p className="think">
          <span className="think-ring" style={{ animationDuration: `${QUESTION_HOLD_MS}ms` }} />
          Premisli …
        </p>
      )}
      {step >= 1 && (
        <p className="chalk-answer">
          <ChalkWords text={answer.govor} />
        </p>
      )}
    </div>
  );
}

function SummaryScene({ scene, step }) {
  return (
    <div className="scene">
      <Heading text={scene.naslov || 'Povzetek'} />
      <ul className="checklist">
        {scene.koraki.slice(0, step + 1).map((k, i) => (
          <li key={i}>
            <svg className="check" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12.5l5 5L20 6" pathLength="1" />
            </svg>
            <span>
              <ChalkWords text={k.a || k.govor} delay={300} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SCENES = {
  naslov: TitleScene,
  besedilo: TextScene,
  pojem: ConceptScene,
  racun: CalcScene,
  preglednica: TableScene,
  graf: GraphScene,
  primerjava: CompareScene,
  koraki: StepsScene,
  vprasanje: QuestionScene,
  povzetek: SummaryScene,
};

export function SceneView({ scene, step, holding }) {
  const View = SCENES[scene.tip] ?? TextScene;
  return <View scene={scene} step={step} holding={holding} />;
}

// Podnapis pokažemo samo, kadar na tabli ni zapisana prav ta poved
function needsCaption(scene, k) {
  if (!k.govor) return false;
  if (scene.tip === 'besedilo' || scene.tip === 'vprasanje') return false;
  if (scene.tip === 'racun') return hasPair(k);
  if (scene.tip === 'pojem' || scene.tip === 'povzetek') return Boolean(k.a);
  return true;
}

// Takti prizora: kaj glas pove, ali je to treba podnasloviti in koliko počakati po tem
export function sceneBeats(scene) {
  // Prizor brez korakov (npr. dodan naslov) glas samo prebere, besedilo je že na tabli
  if (scene.koraki.length === 0) return [{ say: scene.naslov, caption: false, hold: TITLE_HOLD_MS }];
  return scene.koraki.map((k, i) => ({
    say: k.govor,
    caption: needsCaption(scene, k),
    hold: i === 0 && scene.tip === 'vprasanje' ? QUESTION_HOLD_MS : i === 0 && scene.tip === 'naslov' ? TITLE_HOLD_MS : 0,
  }));
}
