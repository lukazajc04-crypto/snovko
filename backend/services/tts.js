// Naravni slovenski glas za animirano razlago (Microsoft Azure, nevronski glas Petra).
// Brez AZURE_SPEECH_KEY in AZURE_SPEECH_REGION je izklopljen in razlago bere glas naprave.

const VOICE = process.env.AZURE_SPEECH_VOICE || 'sl-SI-PetraNeural';
// MP3 s konstantno bitno hitrostjo: brskalnik pozna točno dolžino, iz nje se računa usklajenost slike
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
// Azure dovoli premor največ 5 sekund
const MAX_BREAK_MS = 5000;

const isConfigured = () => Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);

function endpoint() {
  // AZURE_SPEECH_ENDPOINT je samo za lokalni preizkus z nadomestnim strežnikom
  return (
    process.env.AZURE_SPEECH_ENDPOINT ||
    `https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`
  );
}

const XML_ESCAPES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
const escapeXml = text => text.replace(/[<>&'"]/g, c => XML_ESCAPES[c]);

// Ves prizor gre v en posnetek: vsak korak je poved, za njo premor iz scenarija
function ssmlFor(scene) {
  const body = scene.koraki
    .map((k, i) => `${escapeXml(k.govor)}<break time="${Math.min(MAX_BREAK_MS, scene.premori[i])}ms"/>`)
    .join(' ');
  return `<speak version="1.0" xml:lang="sl-SI"><voice xml:lang="sl-SI" name="${VOICE}">${body}</voice></speak>`;
}

class TtsError extends Error {}

async function synthesizeScene(scene) {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
      'User-Agent': 'snovko',
    },
    body: ssmlFor(scene),
  });
  if (!res.ok) throw new TtsError(`Azure TTS je vrnil ${res.status}`);
  const audio = Buffer.from(await res.arrayBuffer());
  const chars = scene.koraki.reduce((sum, k) => sum + k.govor.length, 0);
  console.log(`[azure] prizor »${scene.naslov}«: ${chars} znakov, ${Math.round(audio.length / 1024)} KB`);
  return { audio, chars };
}

module.exports = { isConfigured, synthesizeScene, TtsError, VOICE };
