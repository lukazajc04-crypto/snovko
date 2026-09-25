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

Vsak odstavek naj ima 4 do 6 stavkov in obravnava eno stvar. Odstavke loči s prazno vrstico, temam sledi po vrsti kot se pojavljajo v viru. Piši v preprostem jeziku, primernem razredu, a nikoli na račun popolnosti. Številk, formul, letnic in imen ne posplošuj — prepiši jih točno.

ZVESTOBA VIRU: ne dodajaj dejstev, imen, letnic, številk ali podrobnosti, ki jih v viru ni — tudi če jih veš iz splošnega znanja. Razlaga in ponazoritev smeta pojasniti in približati snov, ne smeta pa uvajati novih trditev o temi snovi ali o osebah in dogodkih v njej. Številke, imena in letnice smejo biti samo tiste iz vira; v ponazoritvi uporabi besede, ne novih številk o temi. Če vir nečesa ne pove, tega ne piši. Piši naravno, pravilno slovenščino; ne uporabljaj besed ali zvez, za katere nisi prepričan, da obstajajo.

POUDARJANJE: najpomembnejše misli v izpisku, ki si jih mora otrok zapomniti (definicije, pravila, formule, ključne lastnosti, pomembne letnice in imena), obkroži z dvojnim enačajem, na primer: Snov je vse, kar ==ima maso in zavzema prostor==. Obkrožen odsek mora biti cela, samostojna misel dolžine 3 do 15 besed, ki jo otrok razume tudi brez preostalega besedila (na primer »Hieroglife je leta 1822 razvozlal Champollion«, ne »leta 1822 ni razvozlal«). Ni posamezna beseda in ni odrezan košček stavka. V vsakem odstavku obkroži 1 do 2 najpomembnejša odseka in skupaj največ desetino besedila — poudarjeno mora biti redko, sicer ne pomeni nič. Ne obkroži celih stavkov razen zelo kratkih, ne obkroži ločil in ne pusti nobene oznake nesparjene. Besedilo znotraj oznak ne spreminjaj — oznake le postavi okoli že napisanega. Oznak ==...== ne uporabljaj nikjer drugje (ne v pojmih, kartončkih ali kvizu).

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
    izpisek: { type: 'string' },
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
  required: ['kicker', 'naslov', 'izpisek', 'pojmi', 'kartoncki', 'kviz'],
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

  // Poudarke je model označil kar v besedilu (==...==). Iz oznak jih preberemo po vrsti, kot
  // si sledijo v izpisku, in besedilo počistimo — tako ujemanje ni odvisno od tega, ali bi model
  // odsek pozneje dobesedno prepisal.
  const { text: izpisek, highlights } = extractHighlights(material.izpisek);
  material.izpisek = izpisek;
  material.poudarki = highlights;

  return material;
}

// Meje, ki jih model ne more preseči, ne glede na to, kaj označi
const HL_MIN_WORDS = 3;
const HL_MAX_WORDS = 15;
const HL_MAX_PER_PARAGRAPH = 2;
const HL_MAX_SHARE = 0.25; // največ četrtina odstavka je lahko poudarjena
const HL_MIN_BUDGET = 40; // kratek odstavek naj vseeno lahko ohrani eno misel

const trimPunctuation = phrase => phrase.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

// Odstavek pregledamo posebej. Če je oznak liho število, so se pari premaknili in bi bili
// poudarjeni prav vmesni deli (vejice, pike) namesto misli — tak odstavek ostane brez poudarkov.
function highlightParagraph(text, highlights) {
  const markerCount = (text.match(/==/g) || []).length;
  const plain = text.replace(/==/g, '');
  if (markerCount === 0 || markerCount % 2 === 1) return plain;

  const budget = Math.max(plain.length * HL_MAX_SHARE, HL_MIN_BUDGET);
  let used = 0;
  let kept = 0;
  return text.replace(/==([^=]+?)==/g, (_, inner) => {
    const phrase = trimPunctuation(inner);
    const words = phrase ? phrase.split(/\s+/).length : 0;
    const fits = words >= HL_MIN_WORDS && words <= HL_MAX_WORDS && used + phrase.length <= budget;
    if (fits && kept < HL_MAX_PER_PARAGRAPH) {
      highlights.push(phrase);
      used += phrase.length;
      kept += 1;
    }
    return inner;
  }).replace(/==/g, '');
}

// Poudarke je model označil kar v besedilu (==...==). Iz oznak jih preberemo po vrsti, kot si
// sledijo v izpisku, in besedilo počistimo — tako ujemanje ni odvisno od tega, ali bi model
// odsek pozneje dobesedno prepisal. Presojo, kaj je še poudarek, opravi koda, ne model.
function extractHighlights(marked) {
  const highlights = [];
  const text = String(marked)
    .split(/(\n+)/)
    .map(part => (/^\n+$/.test(part) ? part : highlightParagraph(part, highlights)))
    .join('');
  return { text, highlights };
}

module.exports = { generateMaterial, GenerationError, extractHighlights };
