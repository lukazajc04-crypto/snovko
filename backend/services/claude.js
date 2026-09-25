const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
// Sonnet namesto Haiku: pri razširjanju vira je Haiku dodajal dejstva, ki jih v snovi ni bilo
// (npr. "francoski študent"), in tvoril neobstoječe slovenske izraze. Otrok to prebere kot resnico.
const MODEL = 'claude-sonnet-5';
const MAX_FLASHCARDS = 12;

// Cene Sonnet 5 ($ na milijon žetonov). Uporabljene le za beleženje stroška, ne za zaračunavanje.
const PRICE_INPUT_PER_MTOK = 2;
const PRICE_OUTPUT_PER_MTOK = 10;

// Do te dolžine vira zadostuje en klic (preizkušeno do ~3300 znakov). Daljšo snov razrežemo na dele,
// ker izpisek zraste 2,5-4-krat: en klic bi zadel strop izhodnih tokenov in trajal več minut.
const SINGLE_CALL_MAX_CHARS = 4000;
const CHUNK_CHARS = 3000;
const CONCURRENCY = 6;

// Prompt je razdeljen na dele, ker ga uporabljajo tri poti: en klic (kratka snov), klic za del
// dolge snovi in klic za pripomočke (pojmi, kartončki, kviz) iz že sestavljenega izpiska.
const PERSONA = `Si prijazen učni pomočnik za slovenskega osnovnošolca. Iz podane šolske snovi pripraviš učno gradivo v slovenščini.`;
const SUMMARY_RULES = `IZPISEK je najpomembnejši del in mora biti BISTVENO OBSEŽNEJŠI od vira. Zajeti mora VSO podano snov — vsako temo, podtemo, definicijo, pravilo, postopek, primer, izjemo, številko, formulo in ime — in jo hkrati RAZLOŽITI, ne le prepisati. Otrok se bo učil samo iz izpiska in izvirne snovi ne bo imel pred seboj. Izpisek naj bo vsaj 1,8-krat daljši od vira; raje predolg kot prekratek, ker ga otrok bere po straneh.

Vsak pojem, pravilo ali dejstvo iz vira obdelaj v svojem odstavku v tem zaporedju:
1. Povej, kaj je, v preprostih besedah, primernih razredu.
2. Razloži, zakaj je tako oziroma kako deluje, tako da otrok razume, ne le zapomni.
3. Dodaj ponazoritev: primer iz vsakdanjega življenja ali primerjavo, ki ustreza razredu (na primer »Predstavljaj si, da …«, »Podobno je, kot ko …«). Ponazoritev naj bo očitno ponazoritev, ne trditev o temi snovi.
4. Če je pojem v viru omenjen le z eno besedo ali stavkom, ga vseeno razloži do konca.

Kjer vir našteva (vrste, koraki, lastnosti, imena), obdelaj vsako točko posebej, vsaka naj dobi svoj odstavek ali vsaj svoj stavek z razlago. Nobene točke ne združuj v skupni stavek.

Dolžina se ravna po obsegu vira:
- kratek zapisek (nekaj vrstic) → 6 do 8 odstavkov
- ena stran zvezka → 12 do 18 odstavkov
- celo poglavje ali več strani → 25 ali več odstavkov

Vsak odstavek naj ima 4 do 6 stavkov in obravnava eno stvar. Temam sledi po vrsti kot se pojavljajo v viru. Piši v preprostem jeziku, primernem razredu, a nikoli na račun popolnosti. Številk, formul, letnic in imen ne posplošuj — prepiši jih točno.`;
const FAITHFULNESS_RULES = `ZVESTOBA VIRU: ne dodajaj dejstev, imen, letnic, številk ali podrobnosti, ki jih v viru ni — tudi če jih veš iz splošnega znanja. Razlaga in ponazoritev smeta pojasniti in približati snov, ne smeta pa uvajati novih trditev o temi snovi ali o osebah in dogodkih v njej. Številke, imena in letnice smejo biti samo tiste iz vira; v ponazoritvi uporabi besede, ne novih številk o temi. Če vir nečesa ne pove, tega ne piši. Piši naravno, pravilno slovenščino; ne uporabljaj besed ali zvez, za katere nisi prepričan, da obstajajo.`;
const PARAGRAPH_RULES = `ODSTAVKI IN POUDARKI: izpisek vrni kot seznam odstavkov (polje odstavki). Vsak odstavek ima besedilo in polje poudarki. V poudarke VEDNO vpiši 1 ali 2 najpomembnejša odseka tega odstavka, ki si jih mora otrok zapomniti (definicija, pravilo, formula, ključna lastnost, pomembna letnica ali ime). Vsak poudarek DOBESEDNO prepiši iz besedila istega odstavka, znak za znakom (enake črke, končnice in ločila), in mora biti cela, samostojna misel dolžine 3 do 15 besed, ki jo otrok razume tudi brez preostalega besedila (na primer »Hieroglife je leta 1822 razvozlal Champollion«, ne »leta 1822 ni razvozlal«). Poudarek ni posamezna beseda in ni odrezan košček stavka. Poudarjeno mora biti redko: skupaj največ desetina besedila.`;
const AIDS_RULES = `POJMI, KARTONČKI in KVIZ morajo izhajati IZKLJUČNO iz izpiska. Vsak odgovor mora biti mogoče najti v besedilu izpiska, ki si ga pravkar napisal. Ne sprašuj po ničemer, česar v izpisku ni — tudi če to veš iz splošnega znanja ali je bilo v izvirni snovi, a v izpisek ni prišlo.

Število prilagodi obsegu izpiska:
- pojmi: 5 do 25 ključnih izrazov, ki se v izpisku dejansko pojavijo
- kartončki: 6 do 12 parov vprašanje-odgovor (NIKOLI več kot 12; pri obsežni snovi izberi najpomembnejše pojme in jih porazdeli čez vso snov, ne le prvega dela)
- kviz: 5 do 12 vprašanj s štirimi možnostmi

Kartončki in kviz naj skupaj pokrijejo vse odstavke izpiska — nobena tema ne sme ostati nepreverjena. Kviz naj pokriva različne dele izpiska, ne le prvega odstavka. Razlaga ob odgovoru naj pove, zakaj je pravilen.`;

const SYSTEM_PROMPT = [PERSONA, SUMMARY_RULES, FAITHFULNESS_RULES, PARAGRAPH_RULES, AIDS_RULES].join('\n\n');

const CHUNK_PROMPT = [
  PERSONA,
  SUMMARY_RULES,
  FAITHFULNESS_RULES,
  PARAGRAPH_RULES,
  'Dobiš SAMO ENEGA od več delov iste snovi. Obravnavaj samo ta del in v izpisek zajemi vse, kar je v njem. Ne piši uvoda, ki bi predstavljal celotno snov, in ne zaključka; piši, kot da bi bralec že prebral prejšnje dele. Vrni samo polje odstavki.',
].join('\n\n');

const AIDS_PROMPT = [
  PERSONA.split('\n')[0],
  'Dobiš že napisan izpisek učne snovi. Iz njega pripraviš naslov, kratek podnaslov (kicker, na primer predmet in razred), ključne pojme, kartončke in kviz.',
  AIDS_RULES,
  'Kartončki in kviz naj obsegajo vse dele izpiska od začetka do konca, ne le prvega.',
].join('\n\n');

// Structured outputs: API zagotovi, da je odgovor veljaven JSON po tej shemi (brez markdown ovojev)
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    kicker: { type: 'string' },
    naslov: { type: 'string' },
    odstavki: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          besedilo: { type: 'string' },
          poudarki: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
        required: ['besedilo', 'poudarki'],
        additionalProperties: false,
      },
    },
    pojmi: { type: 'array', items: { type: 'string' } },
    kartoncki: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          vprasanje: { type: 'string' },
          odgovor: { type: 'string' },
        },
        required: ['vprasanje', 'odgovor'],
        additionalProperties: false,
      },
    },
    kviz: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          vprasanje: { type: 'string' },
          opcije: { type: 'array', items: { type: 'string' } },
          pravilni_index: { type: 'integer' },
          razlaga: { type: 'string' },
        },
        required: ['vprasanje', 'opcije', 'pravilni_index', 'razlaga'],
        additionalProperties: false,
      },
    },
  },
  required: ['kicker', 'naslov', 'odstavki', 'pojmi', 'kartoncki', 'kviz'],
  additionalProperties: false,
};


const AIDS_SCHEMA = {
  type: 'object',
  properties: {
    kicker: OUTPUT_SCHEMA.properties.kicker,
    naslov: OUTPUT_SCHEMA.properties.naslov,
    pojmi: OUTPUT_SCHEMA.properties.pojmi,
    kartoncki: OUTPUT_SCHEMA.properties.kartoncki,
    kviz: OUTPUT_SCHEMA.properties.kviz,
  },
  required: ['kicker', 'naslov', 'pojmi', 'kartoncki', 'kviz'],
  additionalProperties: false,
};

const CHUNK_SCHEMA = {
  type: 'object',
  properties: { odstavki: OUTPUT_SCHEMA.properties.odstavki },
  required: ['odstavki'],
  additionalProperties: false,
};

class GenerationError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

// Skupni klic: napake API-ja se prevedejo v sporočila za uporabnika na enem mestu
async function callClaude({ system, content, schema, maxTokens = 16000, meter }) {
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new GenerationError('Preveč zahtev naenkrat. Poskusi znova čez minuto.', 503);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw new GenerationError('Ključ za Claude API ni veljaven. Preveri ANTHROPIC_API_KEY.', 500);
    }
    if (err instanceof Anthropic.APIError) {
      throw new GenerationError('AI storitev trenutno ni na voljo. Poskusi znova.', 502);
    }
    throw err;
  }

  // Poraba se šteje tudi, če odgovor pozneje zavrnemo: klic je bil plačan
  if (meter) {
    meter.input += response.usage?.input_tokens ?? 0;
    meter.output += response.usage?.output_tokens ?? 0;
    meter.calls += 1;
  }

  if (response.stop_reason === 'refusal') {
    throw new GenerationError('Iz te snovi ni bilo mogoče ustvariti gradiva.', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new GenerationError('Ta del snovi je preobsežen za obdelavo. Poskusi z manjšim delom.', 422);
  }
  return JSON.parse(response.content.find(block => block.type === 'text').text);
}

const validQuiz = quiz =>
  quiz.every(q => q.opcije.length >= 2 && q.pravilni_index >= 0 && q.pravilni_index < q.opcije.length);

// Prehodna napaka pri enem delu (502/503) ne sme podreti cele snovi: poskusimo še enkrat
async function withRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GenerationError && (err.status === 502 || err.status === 503)) return fn();
    throw err;
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Naslov brez končnega ločila ne sme ostati sam na koncu dela — sodi k besedilu za njim
const looksLikeHeading = line => line.length <= 80 && !/[.!?:;,]$/.test(line);

function splitLongBlock(block) {
  const sentences = block.match(/[^.!?]+[.!?]+["»)]*\s*|[^.!?]+$/g) || [block];
  const parts = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > CHUNK_CHARS) {
      parts.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Reže po odstavkih in naslovih, nikoli sredi odstavka (razen če je en sam odstavek daljši od dela)
function splitSource(text) {
  const blocks = text
    .split(/\n+/)
    .map(b => b.trim())
    .filter(Boolean)
    .flatMap(b => (b.length > CHUNK_CHARS ? splitLongBlock(b) : [b]));

  const chunks = [];
  let current = [];
  let size = 0;
  for (const block of blocks) {
    if (current.length > 0 && size + block.length > CHUNK_CHARS) {
      const orphan = current.length > 1 && looksLikeHeading(current[current.length - 1]) ? current.pop() : null;
      chunks.push(current.join('\n'));
      current = orphan ? [orphan] : [];
      size = current.reduce((sum, b) => sum + b.length, 0);
    }
    current.push(block);
    size += block.length;
  }
  if (current.length > 0) chunks.push(current.join('\n'));

  // Zadnji drobec (npr. ena vrstica) združimo s prejšnjim delom
  if (chunks.length > 1 && chunks[chunks.length - 1].length < 400) {
    const last = chunks.pop();
    chunks[chunks.length - 1] += '\n' + last;
  }
  return chunks;
}

function finish(material, paragraphs) {
  if (!validQuiz(material.kviz)) {
    throw new GenerationError('AI je vrnil neveljaven kviz. Poskusi znova.', 502);
  }
  // Izpisek in poudarke sestavimo iz strukturiranih odstavkov. Shranjena oblika ostane ista
  // (izpisek kot niz, poudarki kot seznam), zato ostalo kodo to ne zadeva.
  const { izpisek, poudarki } = assembleSummary(paragraphs);
  if (!izpisek) {
    throw new GenerationError('AI je vrnil prazen izpisek. Poskusi znova.', 502);
  }
  return {
    kicker: material.kicker,
    naslov: material.naslov,
    izpisek,
    poudarki,
    pojmi: material.pojmi,
    // Varovalka: model navodilo o številu kartončkov včasih preseže
    kartoncki: material.kartoncki.slice(0, MAX_FLASHCARDS),
    kviz: material.kviz,
  };
}

// Dolga snov: dele izpišemo vzporedno, nato iz celotnega izpiska naredimo kartončke in kviz
async function generateLong({ text, subject, grade, meter }) {
  const intro = `Predmet: ${subject}\nRazred: ${grade}. razred osnovne šole`;
  const chunks = splitSource(text);

  const parts = await mapLimit(chunks, CONCURRENCY, (chunk, i) =>
    withRetry(() =>
      callClaude({
        system: CHUNK_PROMPT,
        schema: CHUNK_SCHEMA,
        meter,
        content: `${intro}\n\nTo je del ${i + 1} od ${chunks.length} iste snovi. V izpisek zajemi vse, kar je v njem, od začetka do konca.\n\nDel snovi:\n${chunk}`,
      })
    )
  );
  const paragraphs = parts.flatMap(part => part.odstavki);
  const { izpisek } = assembleSummary(paragraphs);
  if (!izpisek) throw new GenerationError('AI je vrnil prazen izpisek. Poskusi znova.', 502);

  const aids = await withRetry(() =>
    callClaude({
      system: AIDS_PROMPT,
      schema: AIDS_SCHEMA,
      meter,
      content: `${intro}\n\nIzpisek:\n${izpisek}`,
    })
  );
  return finish(aids, paragraphs);
}

async function generateSingle({ text, image, subject, grade, meter }) {
  const intro = `Predmet: ${subject}\nRazred: ${grade}. razred osnovne šole`;
  const content = image
    ? [
        { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } },
        {
          type: 'text',
          text: `${intro}\n\nŠolska snov je na fotografiji (stran iz zvezka ali delovni list). Preberi celotno fotografijo, tudi robove in morebitne opombe, in v izpisek zajemi vse, kar je na njej.`,
        },
      ]
    : `${intro}\n\nŠolska snov:\n${text}\n\nV izpisek zajemi vso zgornjo snov, od začetka do konca.`;

  const material = await callClaude({ system: SYSTEM_PROMPT, schema: OUTPUT_SCHEMA, content, meter });
  return finish(material, material.odstavki);
}

// Vrne gradivo in dejansko porabo AI (žetoni in strošek), da se zabeleži poleg generiranja
async function generateMaterial({ text, image, subject, grade }) {
  const meter = { input: 0, output: 0, calls: 0 };
  const material =
    !image && text.length > SINGLE_CALL_MAX_CHARS
      ? await generateLong({ text, subject, grade, meter })
      : await generateSingle({ text, image, subject, grade, meter });

  const costUsd = (meter.input * PRICE_INPUT_PER_MTOK + meter.output * PRICE_OUTPUT_PER_MTOK) / 1e6;
  const usage = { calls: meter.calls, inputTokens: meter.input, outputTokens: meter.output, costUsd };
  console.log(
    `[claude] ${meter.calls} klicev, ${meter.input} vhodnih + ${meter.output} izhodnih žetonov ≈ $${costUsd.toFixed(4)}`
  );
  return { material, usage };
}

// Meje, ki jih model ne more preseči, ne glede na to, kaj vrne
const HL_MIN_WORDS = 3;
const HL_MAX_WORDS = 15;
const HL_MAX_PER_PARAGRAPH = 2;
const HL_MAX_SHARE = 0.35; // največ tretjina odstavka je lahko poudarjena (en kratek stavek mora stati)
const HL_MIN_BUDGET = 40; // kratek odstavek naj vseeno lahko ohrani eno misel

const trimPunctuation = phrase => phrase.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

// Model poudarka pogosto ne prepiše dobesedno, ampak ga preoblikuje (drugačna končnica, izpuščena
// beseda). Zato dobesedno iskanje zavrže večino poudarkov. Če dobesednega zadetka ni, poiščemo
// tisti strnjeni odsek odstavka, ki se z besedami poudarka najbolj ujema; poudarek je tako vedno
// pravi odsek besedila, ne model-ov izmišljen zapis.
const stemOf = word => {
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return w.length > 5 ? w.slice(0, 5) : w; // slovenske končnice se spreminjajo, koren ne
};

function tokenize(text) {
  return [...text.matchAll(/\S+/g)]
    .map(m => ({ start: m.index, end: m.index + m[0].length, stem: stemOf(m[0]) }))
    .filter(t => t.stem);
}

function locate(text, phrase) {
  const exact = text.indexOf(phrase);
  if (exact !== -1) return { start: exact, end: exact + phrase.length };

  const wanted = tokenize(phrase).map(t => t.stem);
  if (wanted.length < HL_MIN_WORDS) return null;
  const wantedSet = new Set(wanted);
  const tokens = tokenize(text);
  let best = null;

  for (let i = 0; i < tokens.length; i++) {
    for (let len = Math.max(HL_MIN_WORDS, wanted.length - 2); len <= wanted.length + 3 && i + len <= tokens.length; len++) {
      const first = tokens[i];
      const last = tokens[i + len - 1];
      // Odsek se začne in konča z vsebinsko besedo, ne z "je" ali "in"
      if (!wantedSet.has(first.stem) || !wantedSet.has(last.stem) || first.stem.length < 4 || last.stem.length < 4) continue;
      // Poudarek ne sme segati čez konec stavka: "…velikosti. Pri presejanju" je napačen košček
      if (/[.!?]["»)]*\s+[A-ZČŠŽ]/.test(text.slice(first.start, last.end))) continue;
      const window = tokens.slice(i, i + len);
      const hits = window.filter(t => wantedSet.has(t.stem)).length;
      const covered = new Set(window.map(t => t.stem).filter(stem => wantedSet.has(stem))).size;
      // F1: odsek ne sme biti poln nepovezanih besed (natančnost) in mora zajeti večino poudarka (obseg)
      const precision = hits / len;
      const recall = covered / wantedSet.size;
      const score = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
      if (!best || score > best.score) best = { score, start: first.start, end: last.end };
    }
  }
  return best && best.score >= 0.6 ? best : null;
}

// Če poudarek zajame večino kratkega stavka, ga razširimo na cel stavek: odrezan košček
// (»…zato sestavin s prostim očesom«) lahko pomeni nasprotno od celega stavka.
const SENTENCE_MAX_WORDS = 22;
const SENTENCE_MIN_COVER = 0.5;

function expandToSentence(text, hit) {
  const bounds = [0];
  for (const m of text.matchAll(/[.!?]["»)]*\s+(?=[A-ZČŠŽ0-9"»])/g)) bounds.push(m.index + m[0].length);
  bounds.push(text.length);
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const end = bounds[i + 1];
    if (hit.start < start || hit.start >= end) continue;
    const sentence = text.slice(start, end);
    const words = sentence.trim().split(/\s+/).length;
    const covered = text.slice(hit.start, Math.min(hit.end, end)).trim().split(/\s+/).length;
    if (words <= SENTENCE_MAX_WORDS && covered / words >= SENTENCE_MIN_COVER) return { start, end };
    return hit;
  }
  return hit;
}

function paragraphHighlights(text, candidates) {
  const budget = Math.max(text.length * HL_MAX_SHARE, HL_MIN_BUDGET);
  const found = [];
  for (const raw of candidates || []) {
    const located = locate(text, trimPunctuation(String(raw).trim()));
    if (!located) continue;
    const hit = expandToSentence(text, located);
    const phrase = trimPunctuation(text.slice(hit.start, hit.end));
    const words = phrase.split(/\s+/).length;
    if (words < HL_MIN_WORDS || words > HL_MAX_WORDS) continue;
    const start = text.indexOf(phrase);
    // Prekrivajoči se in podvojeni poudarki bi se v odjemalcu izničili
    if (found.some(f => start < f.start + f.phrase.length && start + phrase.length > f.start)) continue;
    found.push({ phrase, start });
  }
  found.sort((a, b) => a.start - b.start);

  const kept = [];
  let used = 0;
  for (const f of found) {
    if (kept.length >= HL_MAX_PER_PARAGRAPH || used + f.phrase.length > budget) continue;
    kept.push(f.phrase);
    used += f.phrase.length;
  }
  return kept;
}

function assembleSummary(paragraphs) {
  const texts = [];
  const highlights = [];
  for (const p of paragraphs || []) {
    const text = String(p.besedilo || '').trim();
    if (!text) continue;
    texts.push(text);
    highlights.push(...paragraphHighlights(text, p.poudarki));
  }
  return { izpisek: texts.join('\n\n'), poudarki: highlights };
}

module.exports = { generateMaterial, GenerationError, assembleSummary };
