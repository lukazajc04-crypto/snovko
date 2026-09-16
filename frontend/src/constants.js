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

export const GENERATION_COST = 2;

export function formatDate(sqliteDate, options = { day: 'numeric', month: 'long' }) {
  return new Date(`${sqliteDate.replace(' ', 'T')}Z`).toLocaleDateString('sl-SI', options);
}
