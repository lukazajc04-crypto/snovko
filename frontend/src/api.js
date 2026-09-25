import axios from 'axios';

export const TOKEN_KEY = 'snovko_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
});

// Render na brezplačnem paketu zaspi; prvi klic potem traja 20-50 s. Brez tega
// izgleda aplikacija zamrznjena, zato o dolgem čakanju obvestimo uporabnika.
const SLOW_AFTER_MS = 4000;
// Generiranje in pregled listov sta dolga po naravi in imata svoj prikaz čakanja; obvestilo
// o prebujanju strežnika bi tam lagalo
const LONG_BY_DESIGN = /^\/api\/(generate|checks|exercises)\/?$/;
let pending = 0;
let slowTimer = null;

function announce(slow) {
  window.dispatchEvent(new CustomEvent('snovko:slow-request', { detail: { slow } }));
}

function requestStarted() {
  pending += 1;
  if (pending === 1) slowTimer = setTimeout(() => announce(true), SLOW_AFTER_MS);
}

function requestFinished() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    clearTimeout(slowTimer);
    announce(false);
  }
}

api.interceptors.request.use(config => {
  config.trackSlow = !(config.method === 'post' && LONG_BY_DESIGN.test(config.url || ''));
  if (config.trackSlow) requestStarted();
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => {
    if (response.config.trackSlow) requestFinished();
    return response;
  },
  error => {
    if (error.config?.trackSlow) requestFinished();
    return Promise.reject(error);
  }
);

export function errorMessage(err, fallback = 'Prišlo je do napake. Poskusi znova.') {
  if (!err.response) return 'Strežnik ni dosegljiv. Preveri internetno povezavo.';
  return err.response.data?.error || fallback;
}

export default api;
