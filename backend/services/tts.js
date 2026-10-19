// Naravni glas za animirano razlago. Vsak korak (ena poved) dobi svoj posnetek, premore med koraki
// naredi predvajalnik sam, zato se slika natančno ujema z glasom.
// Ponudnik: ElevenLabs (ELEVENLABS_API_KEY, živahnejši) ali Microsoft Azure (AZURE_SPEECH_KEY +
// AZURE_SPEECH_REGION, cenejši). Brez ključa je izklopljen in razlago bere glas naprave.

// »Matilda«: topel ženski glas iz ElevenLabsove knjižnice; drugega izbereš z ELEVENLABS_VOICE_ID
const ELEVENLABS_VOICE = 'XrExE9yKIg1WjnnlVkGX';
const AZURE_VOICE = 'sl-SI-PetraNeural';

const XML_ESCAPES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
const escapeXml = text => text.replace(/[<>&'"]/g, c => XML_ESCAPES[c]);

class TtsError extends Error {}

async function elevenLabs(text) {
  const voice = process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_VOICE;
  // ELEVENLABS_ENDPOINT je samo za lokalni preizkus z nadomestnim strežnikom
  const base = process.env.ELEVENLABS_ENDPOINT || 'https://api.elevenlabs.io';
  return fetch(`${base}/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_v3' }),
  });
}

async function azure(text) {
  const voice = process.env.AZURE_SPEECH_VOICE || AZURE_VOICE;
  const endpoint =
    process.env.AZURE_SPEECH_ENDPOINT ||
    `https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'snovko',
    },
    body: `<speak version="1.0" xml:lang="sl-SI"><voice xml:lang="sl-SI" name="${voice}">${escapeXml(text)}</voice></speak>`,
  });
}

function provider() {
  if (process.env.ELEVENLABS_API_KEY) return { name: 'elevenlabs', request: elevenLabs };
  if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) return { name: 'azure', request: azure };
  return null;
}

const isConfigured = () => provider() !== null;

async function synthesize(text) {
  const tts = provider();
  if (!tts) throw new TtsError('Glas ni nastavljen');
  const res = await tts.request(text);
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new TtsError(`${tts.name} je vrnil ${res.status} ${detail}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  console.log(`[${tts.name}] ${text.length} znakov, ${Math.round(audio.length / 1024)} KB`);
  return { audio, chars: text.length };
}

module.exports = { isConfigured, synthesize, TtsError };
