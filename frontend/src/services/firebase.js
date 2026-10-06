import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  projectId: "grana3d-50f06",
  appId: "1:1058476077888:web:38ca66cbadbe96ba8480a5",
  storageBucket: "grana3d-50f06.firebasestorage.app",
  apiKey: "AIzaSyCxTmw1jeRQ2vi4Q5wYxWBmNPomkuIea5A",
  authDomain: "grana3d-50f06.firebaseapp.com",
  messagingSenderId: "1058476077888",
  measurementId: "G-XTHM4G73Y5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Redirección a Google mediante Firebase.
 *
 * Antes se usaba `signInWithPopup`, pero con `Cross-Origin-Opener-Policy` el
 * popup se abre en un contexto de navegación separado: `window.closed` deja de
 * ser observable y el login se quedaba esperando para siempre. El redirect no
 * depende de poder observar el popup, así que es el camino estable.
 */
export async function loginWithFirebaseGoogle() {
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Recupera el resultado de un `signInWithRedirect` al volver de Google.
 *
 * Hace falta porque `onAuthStateChanged` no distingue entre "nunca hubo login"
 * y "el redirect se perdió": si el almacenamiento en iframes está bloqueado
 * (Edge con Tracking Prevention), `getRedirectResult` lanza
 * `auth/operation-not-supported-in-this-environment`, que es la señal clara
 * para avisarle al usuario en vez de dejarlo esperando.
 *
 * @returns {Promise<{ ok: boolean, user: object|null, blocked: boolean, message: string }}>
 */
export async function consumeGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    const user = result?.user || null;
    return {
      ok: Boolean(user?.email),
      user,
      blocked: false,
      message: user?.email ? '' : 'Google no devolvió una cuenta válida.',
    };
  } catch (err) {
    const code = String(err?.code || '');
    const blocked =
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/popup-blocked' ||
      code === 'auth/web-storage-unsupported';
    return {
      ok: false,
      user: null,
      blocked,
      message: blocked
        ? 'Este navegador está bloqueando el almacenamiento que necesita el acceso con Google. Probá con Chrome o Firefox, o usá el acceso con correo y código.'
        : err?.message || 'No se pudo completar el acceso con Google.',
    };
  }
}

export async function logoutFirebase() {
  await signOut(auth);
}

export { onAuthStateChanged };
