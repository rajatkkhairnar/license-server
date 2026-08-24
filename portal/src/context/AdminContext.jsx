/**
 * AdminContext.jsx — Admin Authentication Context
 *
 * Manages admin JWT token and auth state.
 * Token is stored in sessionStorage (tab-scoped, lost on close).
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const AdminContext = createContext(null);

const API_BASE = '';

export const AdminProvider = ({ children }) => {
  const [token, setToken] = useState(() => sessionStorage.getItem('adminToken') || null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Login failed.' };
      }
      setToken(data.token);
      sessionStorage.setItem('adminToken', data.token);
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot connect to server.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    sessionStorage.removeItem('adminToken');
  }, []);

  /** Authenticated fetch wrapper */
  const apiFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      logout();
      throw new Error('Session expired');
    }
    return res;
  }, [token, logout]);

  return (
    <AdminContext.Provider value={{ token, login, logout, loading, apiFetch }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be inside AdminProvider');
  return ctx;
};
