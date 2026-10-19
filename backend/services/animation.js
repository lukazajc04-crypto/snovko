const { callClaude, withRetry, usageFrom, GenerationError } = require('./claude');

// Scenarij animirane razlage: zaporedje prizorov na tabli, ki jih glas bere korak za korakom.
// Nastane iz že shranjenega izpiska (ne iz vira), zato se drži istih dejstev kot kartončki in kviz.

const MAX_SCENES = 14;
const MAX_STEPS = 10;
const MAX_COLUMNS = 8;
const MIN_SCENES = 3;

// Premori po vsakem koraku (ms). Določa jih strežnik, da glas iz brskalnika in posnetek z Azura
// tečeta enako in da se slika ujema z zvokom.
const PAUSE_AFTER_SPEECH_MS = 450;
const SILENT_STEP_MS = 900;
const TITLE_PAUSE_MS = 700;
const SCENE_END_MS = 400;

const ANIMATION_PROMPT = `Si Snovko, prijazen učitelj, ki iz izpiska šolske snovi pripravi scenarij za kratko animirano razlago na šolski tabli. Snov razložiš po domače, kot starejši brat ali sestra za kuhinjsko mizo: sproščeno, toplo in z malo navdušenja. Otrok animacijo gleda, besedilo pa mu prebere glas, zato piši tako, kot se govori: kratke povedi, vsakdanje besede, otroka nagovarjaj s »ti«. Sem ter tja ga kaj vprašaj (»Kaj misliš?«) ali spodbudi (»Super!«, »Bravo, zdaj pa …«) in uporabi vezne besede iz pogovora (»Glej,«, »Veš kaj?«, »Zdaj pa poglejva …«), a vzklikov ne ponavljaj v vsaki povedi. Ostani v pravilni slovenščini brez narečja in slenga, ker ju glas ne zna prebrati. Ton naj bo tak: »Glej, v petih zabojih je skupaj 85 kilogramov mandarin. Koliko jih je potem v enem? Preprosto, razdeliva jih na pet enakih delov!«

PRIZORI: 7 do 12 prizorov v vrstnem redu izpiska. Prvi je vedno »naslov«, zadnji »povzetek«, tik pred njim pa »vprasanje«, ki preveri bistvo. Za vmesne prizore izberi vrsto, ki snov pokaže najbolje. Kjer snov vsebuje račune, preglednice ali grafe, jih pokaži s temi prizori, ne z besedilom. Besedilo uporabi le, kjer nobena druga vrsta ne ustreza. Iste vrste ne uporabi več kot trikrat.

KORAKI: vsak prizor je seznam korakov. V vsakem koraku glas prebere »govor«, na tabli pa se pokaže, kar določata polji a in b glede na vrsto prizora. Polje, ki ga vrsta ne potrebuje, je prazen niz.
- naslov: naslov snovi; 1 do 2 koraka uvoda (samo govor).
- besedilo: 2 do 4 koraki, vsak ena ključna poved, ki se izpiše; a = dobesedni odsek te povedi (2 do 6 besed), ki se podčrta, ali prazen niz.
- pojem: naslov = pojem; koraki so definicija in primer (govor; a = krajši zapis na tabli ali prazen niz).
- racun: prvi korak pove nalogo (samo govor); nato po en korak za vsak račun: a = izraz samo s števili in znaki, brez enačaja (»85 : 5«), b = rezultat, po želji z enoto (»17 kg«), govor = račun z besedami (»85 deljeno s 5 je 17«); zadnji korak pove odgovor (samo govor).
- preglednica: prvi korak je uvod (samo govor); nato po en korak za vsak stolpec: a = vrednost zgornje vrstice, b = vrednost spodnje vrstice, govor = kratka poved ali prazen niz; zadnji korak pove pravilo (samo govor). Največ 7 stolpcev.
- graf: prvi korak je uvod (samo govor); nato po en korak za vsako točko: a = x, b = y (nenegativni števili; pri premem sorazmerju najprej točka 0 in 0), govor je lahko prazen niz; zadnji korak razloži črto (samo govor).
- primerjava: vsak korak je ena vrstica primerjave: a = lastnost prve stvari, b = lastnost druge (do 6 besed), govor = poved o tej razliki ali podobnosti.
- koraki: zaporedje, krog ali časovnica; vsak korak: a = kratek naslov koraka ali letnica, b = kratek opis (do 8 besed), govor = poved.
- vprasanje: točno dva koraka. Prvi: govor = vprašanje otroku, a = pravilen odgovor (do 6 besed), b = napačen, a verjeten odgovor (do 6 besed); otrok izbere enega s klikom. Drugi: govor = razlaga, ki se začne z »Pravilno je …«; ne hvali in ne graja, ker ne veš, kaj je otrok izbral.
- povzetek: 3 do 5 korakov, vsak ena ključna misel: govor = poved, a = kratek zapis na tabli (do 6 besed).

PODATKI ima vsak prizor; pomembni so pri preglednici, grafu, primerjavi in korakih, pri drugih vrstah vpiši prazne nize, odnos »drugo«, koeficient 0 in obliko »brez«:
- oznaka_x, oznaka_y: pri preglednici imeni vrstic z enoto (»število zabojev«, »masa (kg)«), pri grafu imeni osi, pri primerjavi imeni stvari, ki ju primerjaš; sicer prazen niz.
- odnos: »premo«, če je b = koeficient · a, »obratno«, če je a · b = koeficient, sicer »drugo« s koeficientom 0.
- enacba: pri grafu ali preglednici na primer »m = 17 · n«, sicer prazen niz.
- oblika: pri korakih »zaporedje«, »cikel« (krog, ki se ponavlja, na primer kroženje vode) ali »casovnica« (dogodki z letnicami); sicer »brez«.

DOLŽINA: vse, kar prebere glas, ima skupaj 150 do 400 besed (1 do 3 minute). Vsaka poved ima največ 20 besed.

ZVESTOBA: uporabi samo dejstva, imena, letnice in števila iz izpiska. Nova števila smeš le izračunati po pravilu iz izpiska (na primer z istim koeficientom) in morajo biti točna. Ničesar ne dodajaj iz splošnega znanja.

GLAS: v govoru piši števila s števkami, računske znake pa z besedami (»deljeno s«, »krat«, »je enako«), ker jih glas sicer prebere narobe.`;

const str = { type: 'string' };
const obj = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

// Ena splošna oblika prizora namesto ločene sheme za vsako vrsto: API zavrne prevelike sheme
const ANIMATION_SCHEMA = obj({
  prizori: {
    type: 'array',
    items: obj(
      {
        tip: {
          type: 'string',
          enum: ['naslov', 'besedilo', 'pojem', 'racun', 'preglednica', 'graf', 'primerjava', 'koraki', 'vprasanje', 'povzetek'],
        },
        naslov: str,
        koraki: { type: 'array', items: obj({ govor: str, a: str, b: str }) },
        podatki: obj({
          oznaka_x: str,
          oznaka_y: str,
          odnos: { type: 'string', enum: ['premo', 'obratno', 'drugo'] },
          koeficient: { type: 'number' },
          enacba: str,
          oblika: { type: 'string', enum: ['zaporedje', 'cikel', 'casovnica', 'brez'] },
        }),
      },
      // Podatki so obvezni za vse prizore: kot neobvezne jih je model pri preglednicah in grafih izpuščal
      ['tip', 'naslov', 'koraki', 'podatki']
    ),
  },
});

const clean = value => String(value ?? '').trim();

// Števila v slovenskem zapisu: decimalna vejica, presledek med tisočicami ("1 000"), enota za številom
const compactDigits = s => String(s).replace(/(\d)\s+(?=\d)/g, '$1');

function parseNumber(s) {
  const m = compactDigits(s).trim().replace(/−/g, '-').match(/^-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : NaN;
}

function decimalsOf(s) {
  const m = compactDigits(s).trim().match(/^[-−]?\d+(?:[.,](\d+))?/);
  return m?.[1]?.length ?? 0;
}

// Izračuna številski izraz (»4,20 : 6«, »17 · 3«); vrne null, če v njem niso samo števila in znaki
function evaluate(expression) {
  const src = compactDigits(expression)
    .replace(/\s+/g, '')
    .replace(/[·×*]/g, '*')
    .replace(/[:÷/]/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/,/g, '.');
  if (!src || !/^[\d.+\-*/()]+$/.test(src)) return null;

  let i = 0;
  const number = () => {
    const m = src.slice(i).match(/^\d+(?:\.\d+)?/);
    if (!m) throw new Error('pričakovano število');
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = () => {
    if (src[i] === '(') {
      i += 1;
      const v = sum();
      if (src[i] !== ')') throw new Error('manjka zaklepaj');
      i += 1;
      return v;
    }
    if (src[i] === '-') {
      i += 1;
      return -factor();
    }
    return number();
  };
  const product = () => {
    let v = factor();
    while (src[i] === '*' || src[i] === '/') {
      const op = src[i++];
      const r = factor();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const sum = () => {
    let v = product();
    while (src[i] === '+' || src[i] === '-') {
      const op = src[i++];
      const r = product();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  try {
    const v = sum();
    return i === src.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

const round = (v, decimals) => Math.round(v * 10 ** decimals) / 10 ** decimals;

// Zapisano število se ujema z izračunanim, če je to zaokroženo na enako število decimalk
function agrees(value, stated) {
  const target = parseNumber(stated);
  if (Number.isNaN(target)) return false;
  return Math.abs(round(value, decimalsOf(stated)) - target) < 1e-9;
}

const close = (a, b) => Math.abs(a - b) <= 0.005 * Math.abs(b) + 0.01;
const hasPair = k => k.a && k.b;

// Model v izraz včasih zapiše besede (»17 krat 3«); na tabli naj bodo znaki, ki jih je mogoče tudi preveriti
const operatorSigns = expression =>
  expression
    .replace(/\s*\bkrat\b\s*/gi, ' · ')
    .replace(/\s*\bdeljeno\s+[sz]\b\s*/gi, ' : ')
    .replace(/\s*\bplus\b\s*/gi, ' + ')
    .replace(/\s*\bminus\b\s*/gi, ' − ')
    .trim();

// Napačno število na tabli je huje kot manjkajoč prizor, zato prizor z napako zavržemo
function validCalculation(steps) {
  return steps.every(step => {
    const values = step.a.split('=').map(evaluate).filter(v => v !== null);
    // Simbolni zapis (npr. »k = m : n«) se ne da preveriti in ostane
    return values.length === 0 || values.every(v => agrees(v, step.b));
  });
}

function validPairs(pairs, { odnos, koeficient }, numeric) {
  return pairs.every(({ a, b }) => {
    const x = parseNumber(a);
    const y = parseNumber(b);
    if (Number.isNaN(x) || Number.isNaN(y)) return !numeric && odnos === 'drugo';
    if (numeric && (x < 0 || y < 0)) return false;
    if (odnos === 'premo') return numeric ? close(koeficient * x, y) : agrees(koeficient * x, b);
    if (odnos === 'obratno') return x > 0 && close(x * y, koeficient);
    return true;
  });
}

// Vsaka vrsta prizora: obdrži uporabne korake in preveri, ali ima vse, kar potrebuje za prikaz
const PREPARE = {
  naslov: (s, material) => ({ ...s, podnaslov: clean(material.kicker), koraki: s.koraki.filter(k => k.govor).slice(0, 3) }),
  besedilo: s => {
    const koraki = s.koraki
      .filter(k => k.govor)
      .slice(0, 5)
      .map(k => ({ ...k, a: k.govor.toLowerCase().includes(k.a.toLowerCase()) ? k.a : '' }));
    return koraki.length > 0 && { ...s, koraki };
  },
  pojem: s => s.koraki.some(k => k.govor) && s,
  racun: s => {
    const koraki = s.koraki.map(k => (hasPair(k) ? { ...k, a: operatorSigns(k.a) } : k));
    const steps = koraki.filter(hasPair);
    return steps.length > 0 && validCalculation(steps) && { ...s, koraki };
  },
  preglednica: s => {
    const columns = s.koraki.filter(hasPair);
    return (
      s.podatki &&
      columns.length >= 2 &&
      columns.length <= MAX_COLUMNS &&
      validPairs(columns, s.podatki, false) &&
      s
    );
  },
  graf: s => {
    const points = s.koraki.filter(hasPair);
    return s.podatki && points.length >= 2 && validPairs(points, s.podatki, true) && s;
  },
  primerjava: s => s.podatki?.oznaka_x && s.podatki?.oznaka_y && s.koraki.some(k => k.a || k.b) && s,
  koraki: s => {
    const koraki = s.koraki.filter(k => k.a || k.b);
    const oblika = s.podatki?.oblika === 'cikel' || s.podatki?.oblika === 'casovnica' ? s.podatki.oblika : 'zaporedje';
    return koraki.length >= 2 && { ...s, koraki, podatki: { ...s.podatki, oblika } };
  },
  vprasanje: s => {
    const [question, answer] = s.koraki.filter(k => k.govor);
    if (!question || !answer) return false;
    // Izbira med odgovoroma je mogoča le, če sta oba podana in različna; sicer se odgovor samo razkrije
    const choice = question.a && question.b && question.a.toLowerCase() !== question.b.toLowerCase();
    return { ...s, koraki: [choice ? question : { ...question, a: '', b: '' }, { ...answer, a: '', b: '' }] };
  },
  povzetek: s => {
    const koraki = s.koraki.filter(k => k.govor).slice(0, 6);
    return koraki.length > 0 && { ...s, koraki };
  },
};

function pausesFor(scene) {
  return scene.koraki.map((k, i) => {
    let ms = k.govor ? PAUSE_AFTER_SPEECH_MS : SILENT_STEP_MS;
    if (scene.tip === 'naslov' && i === 0) ms += TITLE_PAUSE_MS;
    if (i === scene.koraki.length - 1) ms += SCENE_END_MS;
    return ms;
  });
}

function prepareScenes(raw, material) {
  const kept = [];
  const dropped = [];
  for (const scene of raw) {
    const koraki = (scene?.koraki ?? [])
      .map(k => ({ govor: clean(k.govor), a: clean(k.a), b: clean(k.b) }))
      .filter(k => k.govor || k.a || k.b)
      .slice(0, MAX_STEPS);
    const s = { tip: scene?.tip, naslov: clean(scene?.naslov), koraki, ...(scene?.podatki && { podatki: scene.podatki }) };
    const prepared = PREPARE[s.tip]?.(s, material);
    if (prepared) kept.push(prepared);
    else dropped.push(s);
  }
  // Celoten zavržen prizor v dnevniku: brez tega ni mogoče ugotoviti, zakaj je padel na preverjanju
  for (const s of dropped) console.warn(`[animacija] zavržen prizor: ${JSON.stringify(s).slice(0, 600)}`);

  if (kept[0]?.tip !== 'naslov') {
    kept.unshift({ tip: 'naslov', naslov: material.naslov, podnaslov: clean(material.kicker), koraki: [] });
  }
  // Naslov brez uvoda glas vsaj prebere, da ima vsak prizor kaj povedati
  if (kept[0].koraki.length === 0) kept[0] = { ...kept[0], koraki: [{ govor: kept[0].naslov, a: '', b: '' }] };

  return kept.slice(0, MAX_SCENES).map(s => ({ ...s, premori: pausesFor(s) }));
}

async function generateAnimation({ material, subject, grade }) {
  const meter = { input: 0, output: 0, calls: 0 };
  const content = [
    `Predmet: ${subject}`,
    `Razred: ${grade}. razred osnovne šole`,
    `Naslov gradiva: ${material.naslov}`,
    `Ključni pojmi: ${material.pojmi.join(', ')}`,
    '',
    'Izpisek:',
    material.izpisek,
  ].join('\n');

  const result = await withRetry(() =>
    callClaude({ system: ANIMATION_PROMPT, content, schema: ANIMATION_SCHEMA, maxTokens: 8000, meter })
  );
  const prizori = prepareScenes(result.prizori ?? [], material);
  const usage = usageFrom(meter, 'animacija');

  if (prizori.length < MIN_SCENES) {
    throw new GenerationError('Animacije ni bilo mogoče pripraviti. Poskusi znova.', 502);
  }
  return { animation: { prizori }, usage };
}

module.exports = { generateAnimation, evaluate, agrees, prepareScenes };
