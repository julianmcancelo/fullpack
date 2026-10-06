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

  // `authReady` marca que la sesión guardada ya fue validada (o que no había
  // ninguna). La app espera esta señal antes de pedir datos.
  const [authReady, setAuthReady] = useState(false);

  // Revalida la sesión guardada contra el backend al abrir la app:
  // si el token venció o fue revocado, se cierra la sesión local.
  useEffect(() => {
    if (!sessionToken) {
      setAuthReady(true);
      return;
    }
    api.getMe()
      .then((res) => {
        if (res?.user) setCurrentUser(res.user);
      })
      .catch(() => {
        setCurrentUser(null);
        setSessionToken(null);
      })
      .finally(() => setAuthReady(true));
  }, [sessionToken]);

  // Una sesión rechazada por el backend (401) limpia también la sesión de
  // Firebase: si no, el listener de `onAuthStateChanged` re-emite la misma
  // credencial vencida y el panel intenta volver a entrar en bucle.
  useEffect(() => {
    const onExpired = () => {
      setCurrentUser(null);
      setSessionToken(null);
      logoutFirebase().catch(() => {});
    };
    window.addEventListener('ml:session-expired', onExpired);
    return () => window.removeEventListener('ml:session-expired', onExpired);
  }, []); // <-- dependency: revalida cuando cambia el token

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

  /**
   * Inicia sesión con Google y registra/autoriza la cuenta en el backend.
   *
   * Acepta dos formas:
   * 1. `credential`: datos ya resueltos por Google Identity Services (botón /
   *    One Tap). Es el camino normal: no hay popup que monitorizar.
   * 2. Sin argumento: se delega en Firebase, que redirige al proveedor (nunca
   *    popup: `window.closed` no es observable con Cross-Origin-Opener-Policy y
   *    el login se quedaba colgado). Tras volver, el listener de
   *    `onAuthStateChanged` completa el alta en el backend.
   */
  const loginWithGoogle = async (credential = null) => {
    // Camino 1: el credential ya trae la identidad verificada por Google.
    const profile =
      credential && credential.email
        ? {
            email: credential.email,
            name: credential.name || credential.email.split('@')[0],
            avatar: credential.avatar || '',
            googleId: credential.googleId || '',
          }
        : null;

    if (!profile) {
      // Camino 2: redirect. La página se va y vuelve; el listener de
      // onAuthStateChanged (arriba) hace el alta en el backend al volver.
      await loginWithFirebaseGoogle();
      return { success: true, redirecting: true };
    }

    const res = await api.googleLogin(profile);
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
        authReady,
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
