import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const saveSession = useCallback(data => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token || user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get('/api/auth/me')
      .then(res => !cancelled && setUser(res.data.user))
      .catch(err => {
        if (!cancelled && err.response?.status === 401) logout();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, user, logout]);

  const login = useCallback(
    async (email, password) => saveSession((await api.post('/api/auth/login', { email, password })).data),
    [saveSession]
  );

  const register = useCallback(
    async fields => saveSession((await api.post('/api/auth/register', fields)).data),
    [saveSession]
  );

  // Ponastavitev vrne isto obliko kot prijava, zato uporabnika kar prijavimo —
  // sicer bi takoj po nastavitvi novega gesla moral vpisati še prijavne podatke
  const resetPassword = useCallback(
    async (resetToken, password) =>
      saveSession((await api.post('/api/auth/reset-password', { token: resetToken, password })).data),
    [saveSession]
  );

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      resetPassword,
      logout,
    }),
    [token, user, loading, login, register, resetPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth mora biti uporabljen znotraj <AuthProvider>');
  return ctx;
}

export function homePathFor(user) {
  return user?.role === 'child' ? '/child' : '/dashboard';
}
