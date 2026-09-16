const crypto = require('crypto');
const db = require('../db/db');

const childOfParent = db.prepare('SELECT * FROM children WHERE id = ? AND parent_id = ?');
const firstChildOfParent = db.prepare('SELECT * FROM children WHERE parent_id = ? ORDER BY id LIMIT 1');
const childOfUser = db.prepare('SELECT * FROM children WHERE user_id = ?');
const childByCode = db.prepare('SELECT * FROM children WHERE access_code = ?');
const linkChild = db.prepare('UPDATE children SET user_id = ? WHERE id = ? AND user_id IS NULL');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class AccessError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function generateAccessCode() {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
    if (!childByCode.get(code)) return code;
  }
}

function findChildForUser(user, childId) {
  if (user.role === 'child') return childOfUser.get(user.id) || null;
  if (childId === undefined || childId === null || childId === '') return firstChildOfParent.get(user.id) || null;
  const id = Number(childId);
  return Number.isInteger(id) ? childOfParent.get(id, user.id) || null : null;
}

function canAccessChild(user, child) {
  return user.role === 'child' ? child.user_id === user.id : child.parent_id === user.id;
}

function childNotFoundMessage(user) {
  return user.role === 'child'
    ? 'Tvoj račun še ni povezan s staršem. Vpiši kodo, ki jo je dobil starš.'
    : 'Otrok ne obstaja ali ni povezan s tvojim računom.';
}

function linkChildAccount(userId, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  const child = code && childByCode.get(code);
  if (!child) throw new AccessError('Koda ne obstaja. Preveri jo pri staršu.');
  if (child.user_id === userId) return child;
  if (child.user_id !== null) throw new AccessError('Ta koda je že uporabljena.', 409);
  if (childOfUser.get(userId)) throw new AccessError('Tvoj račun je že povezan.', 409);
  linkChild.run(userId, child.id);
  return { ...child, user_id: userId };
}

function publicChild(child) {
  return {
    id: child.id,
    name: child.name,
    grade: child.grade,
    subjects: JSON.parse(child.subjects),
  };
}

module.exports = {
  AccessError,
  generateAccessCode,
  findChildForUser,
  canAccessChild,
  childNotFoundMessage,
  linkChildAccount,
  publicChild,
};
