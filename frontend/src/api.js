import axios from 'axios';

export const TOKEN_KEY = 'snovko_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function errorMessage(err, fallback = 'Prišlo je do napake. Poskusi znova.') {
  if (!err.response) return 'Strežnik ni dosegljiv. Preveri internetno povezavo.';
  return err.response.data?.error || fallback;
}

export default api;
