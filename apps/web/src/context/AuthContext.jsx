import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('pa_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(res => { setUser(res.data); setIsAuthenticated(true); })
        .catch(() => { localStorage.removeItem('pa_token'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (password) => {
    const res = await api.post('/auth/login', { password });
    const { token } = res.data;
    localStorage.setItem('pa_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const meRes = await api.get('/auth/me');
    setUser(meRes.data);
    setIsAuthenticated(true);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pa_token');
    delete api.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
