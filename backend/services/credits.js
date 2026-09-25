// Cena generiranja gradiva v kreditih je vezana na dolžino snovi, ker strošek AI raste z njo:
// izpisek je 2,4-4x daljši od vira, zato dolga snov stane veliko več kot ena stran.
// Ista pravila so v frontend/src/constants.js (creditsForText) — spremeni obe hkrati.
const BASE_CREDITS = 2;
const BASE_CHARS = 4000; // do te dolžine (ena stran) velja osnovna cena
const STEP_CREDITS = 2;
const STEP_CHARS = 3000; // za vsak začet nadaljnji del snovi

function creditsForText(chars) {
  if (chars <= BASE_CHARS) return BASE_CREDITS;
  return BASE_CREDITS + STEP_CREDITS * Math.ceil((chars - BASE_CHARS) / STEP_CHARS);
}

// Fotografija je ena stran zvezka
const creditsForImage = () => BASE_CREDITS;

module.exports = { creditsForText, creditsForImage, BASE_CREDITS };
