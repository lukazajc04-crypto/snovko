const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
// Sonnet namesto Haiku: pri razširjanju vira je Haiku dodajal dejstva, ki jih v snovi ni bilo
// (npr. "francoski študent"), in tvoril neobstoječe slovenske izraze. Otrok to prebere kot resnico.
const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `Si prijazen učni pomočnik za slovenskega osnovnošolca. Iz podane šolske snovi pripraviš učno gradivo v slovenščini.

IZPISEK je najpomembnejši del in mora biti BISTVENO OBSEŽNEJŠI od vira. Zajeti mora VSO podano snov — vsako temo, podtemo, definicijo, pravilo, postopek, primer, izjemo, številko, formulo in ime — in jo hkrati RAZLOŽITI, ne le prepisati. Otrok se bo učil samo iz izpiska in izvirne snovi ne bo imel pred seboj. Izpisek naj bo vsaj 1,8-krat daljši od vira; raje predolg kot prekratek, ker ga otrok bere po straneh.

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

Vsak odstavek naj ima 4 do 6 stavkov in obravnava eno stvar. Temam sledi po vrsti kot se pojavljajo v viru. Piši v preprostem jeziku, primernem razredu, a nikoli na račun popolnosti. Številk, formul, letnic in imen ne posplošuj — prepiši jih točno.

ZVESTOBA VIRU: ne dodajaj dejstev, imen, letnic, številk ali podrobnosti, ki jih v viru ni — tudi če jih veš iz splošnega znanja. Razlaga in ponazoritev smeta pojasniti in približati snov, ne smeta pa uvajati novih trditev o temi snovi ali o osebah in dogodkih v njej. Številke, imena in letnice smejo biti samo tiste iz vira; v ponazoritvi uporabi besede, ne novih številk o temi. Če vir nečesa ne pove, tega ne piši. Piši naravno, pravilno slovenščino; ne uporabljaj besed ali zvez, za katere nisi prepričan, da obstajajo.

ODSTAVKI IN POUDARKI: izpisek vrni kot seznam odstavkov (polje odstavki). Vsak odstavek ima besedilo in polje poudarki. V poudarke VEDNO vpiši 1 ali 2 najpomembnejša odseka tega odstavka, ki si jih mora otrok zapomniti (definicija, pravilo, formula, ključna lastnost, pomembna letnica ali ime). Vsak poudarek DOBESEDNO prepiši iz besedila istega odstavka, znak za znakom (enake črke, končnice in ločila), in mora biti cela, samostojna misel dolžine 3 do 15 besed, ki jo otrok razume tudi brez preostalega besedila (na primer »Hieroglife je leta 1822 razvozlal Champollion«, ne »leta 1822 ni razvozlal«). Poudarek ni posamezna beseda in ni odrezan košček stavka. Poudarjeno mora biti redko: skupaj največ desetina besedila.

POJMI, KARTONČKI in KVIZ morajo izhajati IZKLJUČNO iz izpiska. Vsak odgovor mora biti mogoče najti v besedilu izpiska, ki si ga pravkar napisal. Ne sprašuj po ničemer, česar v izpisku ni — tudi če to veš iz splošnega znanja ali je bilo v izvirni snovi, a v izpisek ni prišlo.

Število prilagodi obsegu izpiska:
- pojmi: 5 do 25 ključnih izrazov, ki se v izpisku dejansko pojavijo
- kartončki: 6 do 20 parov vprašanje-odgovor
- kviz: 5 do 12 vprašanj s štirimi možnostmi

Kartončki in kviz naj skupaj pokrijejo vse odstavke izpiska — nobena tema ne sme ostati nepreverjena. Kviz naj pokriva različne dele izpiska, ne le prvega odstavka. Razlaga ob odgovoru naj pove, zakaj je pravilen.`;

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

class GenerationError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function generateMaterial({ text, image, subject, grade }) {
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

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      // Izpisek celega poglavja (15+ odstavkov) skupaj s kartončki in kvizom preseže
      // nekaj tisoč tokenov; prenizek strop bi vrnil "max_tokens" in napako uporabniku
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
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

  if (response.stop_reason === 'refusal') {
    throw new GenerationError('Iz te snovi ni bilo mogoče ustvariti gradiva.', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new GenerationError('Snov je preobsežna za eno generacijo. Razdeli jo na manjše dele.', 422);
  }

  const textBlock = response.content.find(block => block.type === 'text');
  const material = JSON.parse(textBlock.text);

  const quizValid = material.kviz.every(
    q => q.opcije.length >= 2 && q.pravilni_index >= 0 && q.pravilni_index < q.opcije.length
  );
  if (!quizValid) {
    throw new GenerationError('AI je vrnil neveljaven kviz. Poskusi znova.', 502);
  }

  // Izpisek in poudarke sestavimo iz strukturiranih odstavkov. Shranjena oblika ostane ista
  // (izpisek kot niz, poudarki kot seznam), zato ostalo kodo to ne zadeva.
  const { izpisek, poudarki } = assembleSummary(material.odstavki);
  if (!izpisek) {
    throw new GenerationError('AI je vrnil prazen izpisek. Poskusi znova.', 502);
  }
  delete material.odstavki;
  material.izpisek = izpisek;
  material.poudarki = poudarki;

  return material;
}

// Meje, ki jih model ne more preseči, ne glede na to, kaj vrne
const HL_MIN_WORDS = 3;
const HL_MAX_WORDS = 15;
const HL_MAX_PER_PARAGRAPH = 2;
const HL_MAX_SHARE = 0.25; // največ četrtina odstavka je lahko poudarjena
const HL_MIN_BUDGET = 40; // kratek odstavek naj vseeno lahko ohrani eno misel

const trimPunctuation = phrase => phrase.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

// Poudarek mora biti dobesedni odsek svojega odstavka, sicer ga odjemalec ne bi našel. Sheme
// dobesednosti ne morejo prisiliti, zato neveljavne zavrže koda. Poudarki ostanejo v vrstnem
// redu, kot si sledijo v besedilu, ker jih odjemalec išče s kazalcem.
function paragraphHighlights(text, candidates) {
  const budget = Math.max(text.length * HL_MAX_SHARE, HL_MIN_BUDGET);
  const found = [];
  for (const raw of candidates || []) {
    const phrase = trimPunctuation(String(raw).trim());
    const words = phrase ? phrase.split(/\s+/).length : 0;
    const start = words ? text.indexOf(phrase) : -1;
    if (start === -1 || words < HL_MIN_WORDS || words > HL_MAX_WORDS) continue;
    if (found.some(f => f.phrase === phrase)) continue;
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
