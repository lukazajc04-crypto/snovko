export const SUBJECTS = [
  'Matematika',
  'Slovenščina',
  'Angleščina',
  'Naravoslovje',
  'Zgodovina',
  'Geografija',
  'Fizika',
  'Kemija',
  'Biologija',
  'Ostalo',
];

export const GENERATION_COST = 3;

// Ista pravila kot backend/services/credits.js — spremeni obe hkrati.
// Ena stran (do 4000 znakov) = 3 kredite, za vsakih nadaljnjih 3000 znakov še 3.
export function creditsForText(chars) {
  if (chars <= 4000) return 3;
  return 3 + 3 * Math.ceil((chars - 4000) / 3000);
}

export function formatDate(sqliteDate, options = { day: 'numeric', month: 'long' }) {
  return new Date(`${sqliteDate.replace(' ', 'T')}Z`).toLocaleDateString('sl-SI', options);
}
