const Anthropic = require('@anthropic-ai/sdk');
const { GenerationError } = require('./claude');

const client = new Anthropic();
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `Sestavljaš učni list za slovenskega osnovnošolca iz snovi, ki jo je pravkar predelal.

Naloge naj preverjajo razumevanje te iste snovi, ne le dobesednega pomnjenja — otrok naj znanje uporabi na novem primeru. Naredi 6 do 8 nalog, od lažjih k težjim. Vsaka naloga naj bo samostojna in rešljiva brez dostopa do gradiva.

Za vsako nalogo določi "tip", ki pove, koliko prostora za pisanje potrebuje:
- "racun" za računske naloge z enim številskim rezultatom
- "kratek" za odgovor v nekaj besedah ali eni povedi
- "dolg" za odgovor v dveh ali treh povedih

V "resitev" napiši pričakovani odgovor. Pri "dolg" navedi ključne točke, ki jih mora odgovor vsebovati, ker otrok ne bo napisal dobesedno istih besed. V "razlaga" na kratko pojasni, zakaj je tako — to bere starš, ki otroku pomaga.

Vse piši v slovenščini, primerno starosti otroka.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    naslov: { type: 'string' },
    navodilo: { type: 'string' },
    naloge: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          besedilo: { type: 'string' },
          tip: { type: 'string', enum: ['racun', 'kratek', 'dolg'] },
          resitev: { type: 'string' },
          razlaga: { type: 'string' },
        },
        required: ['besedilo', 'tip', 'resitev', 'razlaga'],
        additionalProperties: false,
      },
    },
  },
  required: ['naslov', 'navodilo', 'naloge'],
  additionalProperties: false,
};

const MIN_TASKS = 3;

async function generateExercises({ material, subject, grade }) {
  const snov = [
    `Predmet: ${subject}`,
    `Razred: ${grade}. razred osnovne šole`,
    `Naslov snovi: ${material.naslov}`,
    '',
    'Razlaga, ki jo je otrok predelal:',
    material.izpisek,
    '',
    `Ključni pojmi: ${material.pojmi.join(', ')}`,
  ].join('\n');

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [{ role: 'user', content: snov }],
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
    throw new GenerationError('Iz te snovi ni bilo mogoče sestaviti učnega lista.', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new GenerationError('Snov je preobsežna za en učni list. Razdeli jo na manjše dele.', 422);
  }

  const textBlock = response.content.find(block => block.type === 'text');
  const sheet = JSON.parse(textBlock.text);

  if (sheet.naloge.length < MIN_TASKS) {
    throw new GenerationError('AI je sestavil premalo nalog. Poskusi znova.', 502);
  }

  return sheet;
}

module.exports = { generateExercises };
