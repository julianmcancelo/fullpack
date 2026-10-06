import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  loginWithFirebaseGoogle,
  logoutFirebase,
  onAuthStateChanged,
  consumeGoogleRedirectResult,
  auth,
} from '../services/firebase';

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
  // Se pasa el token explícito: recién emitido aún no está en localStorage.
  useEffect(() => {
    if (!sessionToken) {
      setAuthReady(true);
      return;
    }
    api.getMe(sessionToken)
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

  /**
   * Resultado de la vuelta desde Google.
   *
   * `onAuthStateChanged` sola no alcanza: si el navegador bloqueó el
   * almacenamiento en iframes, la app vuelve sin credencial y el modal queda
   * esperando para siempre. Se escucha `ml:google-login-failed` para que el
   * LoginModal pueda explicar qué pasó.
   */
  useEffect(() => {
    consumeGoogleRedirectResult()
      .then((outcome) => {
        if (outcome.ok) return;
        const detail = outcome.blocked || outcome.message;
        if (!detail) return;
        window.dispatchEvent(
          new CustomEvent('ml:google-login-failed', { detail: { message: detail, blocked: outcome.blocked } })
        );
      })
      .catch(() => {});
  }, []);

  // Sync with Firebase Auth state
  //
  // Se manda el `idToken` de Firebase, no el email: el backend valida esa
  // credencial contra Google. Mandar sólo el email significaba que cualquiera
  // que llamara a la API podía pedir un token de sesión a nombre de otro
  // (incluido el SuperAdmin) sin tener cuenta de Google.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        try {
          const idToken = await fbUser.getIdToken();
          const res = await api.googleLogin({
            idToken,
            email: fbUser.email,
            name: fbUser.displayName || fbUser.email.split('@')[0],
            avatar: fbUser.photoURL || '',
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
   * Inicia sesión con Google.
   *
   * Sin argumentos: delega en Firebase, que redirige al proveedor. Nunca popup:
   * con `Cross-Origin-Opener-Policy` `window.closed` no es observable y el login
   * quedaba colgado. Al volver, el listener de `onAuthStateChanged` (arriba)
   * pide el `idToken` y completa el alta.
   *
   * NO se acepta un perfil armado a mano: el backend exige el `idToken` de
   * Firebase y valida esa credencial contra Google. Aceptar `{email}` suelta
   * permitía pedir un token de sesión a nombre de cualquiera.
   */
  const loginWithGoogle = async () => {
    await loginWithFirebaseGoogle();
    return { success: true, redirecting: true };
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
    // La cuenta que se estaba supervisando no puede sobrevivir al cierre de
    // sesión: si no, el próximo login en este equipo heredaría ese acceso.
    localStorage.removeItem('ml_acting_user');
  };

  // Rol efectivo, con la misma precedencia que el backend:
  //   superadmin -> dueño de la plataforma (gestiona cuentas de usuario).
  //   admin      -> supervisa la operación de otras cuentas.
  //   user       -> sólo su propia cuenta.
  // `ADMIN_EMAIL` siempre gana: es la fuente de verdad del SuperAdmin.
  const email = currentUser?.email?.trim().toLowerCase() || '';
  const role = email && email === ADMIN_EMAIL ? 'superadmin' : currentUser?.role || 'user';

  const isSuperAdmin = role === 'superadmin';
  // Supervisar es una capacidad compartida por Admin y SuperAdmin.
  const isSupervisor = role === 'superadmin' || role === 'admin';

  const roleLabel =
    role === 'superadmin' ? 'SuperAdmin' : role === 'admin' ? 'Administrador' : 'Usuario';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        sessionToken,
        authReady,
        role,
        roleLabel,
        isSuperAdmin,
        isSupervisor,
        // Se conserva por compatibilidad con los componentes que aún lo usan
        // para decidir si pueden supervisar.
        isAdmin: isSupervisor,
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
