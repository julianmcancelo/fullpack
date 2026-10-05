import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

const ADMIN_EMAIL = 'jcancelo.dev@gmail.com';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ml_saas_user');
      if (saved) return JSON.parse(saved);
      return null;
    } catch {
      return null;
    }
  });

  const [sessionToken, setSessionToken] = useState(() => {
    try {
      return localStorage.getItem('ml_saas_token') || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('ml_saas_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('ml_saas_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (sessionToken) {
      localStorage.setItem('ml_saas_token', sessionToken);
    } else {
      localStorage.removeItem('ml_saas_token');
    }
  }, [sessionToken]);

  const loginWithGoogle = async (googleUser) => {
    const res = await api.googleLogin(googleUser);
    if (res.user) {
      setCurrentUser(res.user);
      setSessionToken(res.token);
    }
    return res;
  };

  const loginWithOtp = async (email, code) => {
    const res = await api.verifyOtpCode(email, code);
    if (res.user) {
      setCurrentUser(res.user);
      setSessionToken(res.token);
    }
    return res;
  };

  const logout = () => {
    setCurrentUser(null);
    setSessionToken(null);
    localStorage.removeItem('ml_saas_user');
    localStorage.removeItem('ml_saas_token');
  };

  const isAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL || currentUser?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        sessionToken,
        isAdmin,
        adminEmail: ADMIN_EMAIL,
        loginWithGoogle,
        loginWithOtp,
        logout,
        setCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
