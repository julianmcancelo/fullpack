import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { loginWithFirebaseGoogle, logoutFirebase, onAuthStateChanged, auth } from '../services/firebase';

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

  // Revalida la sesión guardada contra el backend al abrir la app:
  // si el token venció o fue revocado, se cierra la sesión local.
  useEffect(() => {
    if (!sessionToken) return;
    api.getMe()
      .then((res) => {
        if (res?.user) setCurrentUser(res.user);
      })
      .catch(() => {
        setCurrentUser(null);
        setSessionToken(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync with Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        try {
          const res = await api.googleLogin({
            email: fbUser.email,
            name: fbUser.displayName || fbUser.email.split('@')[0],
            avatar: fbUser.photoURL || '',
            googleId: fbUser.uid,
          });
          if (res.user) {
            setCurrentUser(res.user);
            setSessionToken(res.token);
          }
        } catch (e) {
          console.warn('Backend sync note on firebase auth state:', e.message);
        }
      }
    });

    return () => unsubscribe();
  }, []);

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

  const loginWithGoogle = async () => {
    // 1. Popup with Official Firebase Google Auth
    const fbUser = await loginWithFirebaseGoogle();
    if (!fbUser || !fbUser.email) {
      throw new Error('No se pudo autenticar la cuenta de Google.');
    }

    // 2. Sync / Authorize in Backend & Neon Postgres
    const res = await api.googleLogin({
      email: fbUser.email,
      name: fbUser.displayName || fbUser.email.split('@')[0],
      avatar: fbUser.photoURL || '',
      googleId: fbUser.uid,
    });

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

  const logout = async () => {
    try {
      await api.logoutSession();
    } catch {}
    try {
      await logoutFirebase();
    } catch {}
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
