const Anthropic = require('@anthropic-ai/sdk');
const { GenerationError } = require('./claude');

const client = new Anthropic();
// Sonnet namesto Opus: pregled je zaznavanje + preverjanje, ne zahteva najvišje inteligence.
// Opus je stal ~11x več na pregled kot na generiranje gradiva pri isti ceni v kreditih.
const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `Si prijazna učiteljica, ki pregleduje rešen učni list slovenskega osnovnošolca.

Na fotografiji poišči vse naloge in otrokove odgovore (lahko so napisani na roko). Za vsako nalogo preveri, ali je odgovor pravilen. Pri napačnem ali manjkajočem odgovoru napiši pravilno rešitev in kratko razlago, ki jo otrok te starosti razume. Pri pravilnem odgovoru razlaga ni potrebna.

Za vsako nalogo določi točko (x, y) tik za koncem otrokovega odgovora: x naj bo desno od zadnjega napisanega znaka, y na sredini višine odgovora. Tja bomo na sliko narisali kljukico ali križec, zato točka ne sme ležati na samem odgovoru. Koordinati sta v obsegu 0–1000: (0, 0) je levi zgornji kot slike, (1000, 1000) desni spodnji. Če odgovora ni, uporabi konec praznega mesta, kjer bi moral biti.

Rešitev naj bo kratka, največ nekaj besed ali število, ker jo pripišemo neposredno na list. Če odgovora ne moreš zanesljivo prebrati, uporabi status "neberljivo" in ne ugibaj. Če na sliki ni rešenega učnega lista ali naloge, vrni prazen seznam nalog in to prijazno pojasni v povzetku.

Povzetek naslovi na otroka: pohvali, kar mu gre, in spodbudno omeni, kaj naj še ponovi. Vse besedilo piši v slovenščini.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    naslov: { type: 'string' },
    povzetek: { type: 'string' },
    naloge: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stevilka: { type: 'string' },
          naloga: { type: 'string' },
          odgovor_otroka: { type: 'string' },
          status: { type: 'string', enum: ['pravilno', 'napacno', 'neodgovorjeno', 'neberljivo'] },
          resitev: { type: 'string' },
          razlaga: { type: 'string' },
          x: { type: 'integer' },
          y: { type: 'integer' },
        },
        required: ['stevilka', 'naloga', 'odgovor_otroka', 'status', 'resitev', 'razlaga', 'x', 'y'],
        additionalProperties: false,
      },
    },
  },
  required: ['naslov', 'povzetek', 'naloge'],
  additionalProperties: false,
};

const clamp = n => Math.min(1000, Math.max(0, Math.round(n)));

async function checkWorksheet({ image, subject, grade }) {
  let response;
  try {
    response = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } },
              { type: 'text', text: `Predmet: ${subject}\nRazred: ${grade}. razred osnovne šole\n\nPreglej ta rešen učni list.` },
            ],
          },
        ],
      })
      .finalMessage();
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
    throw new GenerationError('Tega lista ni bilo mogoče pregledati.', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new GenerationError('List je preobsežen za en pregled. Fotografiraj ga po delih.', 422);
  }

  const textBlock = response.content.findLast(block => block.type === 'text');
  const result = JSON.parse(textBlock.text);
  result.naloge = result.naloge.map(n => ({ ...n, x: clamp(n.x), y: clamp(n.y) }));
  return result;
}

module.exports = { checkWorksheet };
