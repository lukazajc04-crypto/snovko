const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `Si prijazen učni pomočnik za slovenskega osnovnošolca. Iz podane šolske snovi pripraviš učno gradivo v slovenščini.

IZPISEK je najpomembnejši del. Zajeti mora VSO podano snov — vsako temo, podtemo, definicijo, pravilo, postopek, primer in izjemo, ki se v njej pojavi. Ničesar ne izpusti, tudi če se ti zdi manj pomembno. Otrok se bo učil iz izpiska in ne bo imel izvirne snovi pred seboj.

Dolžina izpiska se ravna po obsegu snovi, ne po vnaprejšnjem številu odstavkov:
- kratek zapisek (nekaj vrstic) → 1 do 2 odstavka
- ena stran zvezka → 3 do 5 odstavkov
- celo poglavje ali več strani → 8 ali več odstavkov

Vsako ločeno temo obdelaj v svojem odstavku, po vrsti kot se pojavljajo v snovi. Odstavke loči s prazno vrstico. Piši v preprostem jeziku, primernem razredu, a ne na račun popolnosti: raje daljši izpisek kot izpuščena snov. Številk, formul, letnic in imen ne posplošuj — prepiši jih točno.

POJMI, KARTONČKI in KVIZ morajo izhajati IZKLJUČNO iz izpiska. Vsak odgovor mora biti mogoče najti v besedilu izpiska, ki si ga pravkar napisal. Ne sprašuj po ničemer, česar v izpisku ni — tudi če to veš iz splošnega znanja ali je bilo v izvirni snovi, a v izpisek ni prišlo.

Število prilagodi obsegu izpiska:
- pojmi: 5 do 12 ključnih izrazov, ki se v izpisku dejansko pojavijo
- kartončki: 5 do 12 parov vprašanje-odgovor
- kviz: 4 do 10 vprašanj s štirimi možnostmi

Kviz naj pokriva različne dele izpiska, ne le prvega odstavka. Razlaga ob odgovoru naj pove, zakaj je pravilen.`;

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
      // Obsežno poglavje z 12 kartončki in 10 vprašanji preseže 4096 tokenov in bi
      // padlo na stop_reason "max_tokens"
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
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

  return material;
}

module.exports = { generateMaterial, GenerationError };
