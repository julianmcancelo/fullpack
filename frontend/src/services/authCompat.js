/**
 * Detección de navegadores que rompen el login con Google.
 *
 * El flujo usa `signInWithRedirect` de Firebase. Funciona bien en Chrome y
 * Firefox, pero Edge con "Tracking Prevention" en modo estricto bloquea el
 * almacenamiento en iframes de terceros (`apis.google.com`), que es justamente
 * donde Firebase conserva el resultado de la autorización. Sin ese
 * almacenamiento el redirect vuelve pero la app no recibe la credencial y se
 * queda esperando: el login "no hace nada", en silencio.
 *
 * No se puede forzar desde el sitio, así que en vez de ocultarlo se detecta y
 * se avisa cuál es el camino confiable (correo con código).
 */

const EDGE_UA = /Edg\//; // Edge Chromium: "Edg/". Excluye a Edge Legacy ("Edge/").
const EDGE_IOS_UA = /EdgiOS\//;
const EDGE_ANDROID_UA = /EdgA\//;

/** ¿Es Microsoft Edge (cualquier variante actual)? */
export function isEdge() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return EDGE_UA.test(ua) || EDGE_IOS_UA.test(ua) || EDGE_ANDROID_UA.test(ua);
}

/**
 * ¿El navegador bloquea el almacenamiento en iframes de terceros?
 *
 * No hay API directa, así que se mide: se escribe una cookie de sesión dentro
 * de un iframe de otro origen y se espera a que el navegador la reporte. Con
 * Tracking Prevention activo la cookie no sobrevive.
 *
 * @param {number} timeoutMs cuánto esperar antes de asumir que funciona
 * @returns {Promise<boolean>} true si el almacenamiento en iframe está bloqueado
 */
export function detectIframeStorageBlocked(timeoutMs = 1200) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(false);

    let settled = false;
    const finish = (blocked) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        iframe.remove();
      } catch {}
      resolve(blocked);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
    // `ml-probe` no resuelve en ningún lado: si el navegador la bloquea igual,
    // el evento never llega y el timeout define el resultado.
    iframe.src = 'https://ml-probe.invalid/cookie';

    iframe.onload = () => {
      try {
        const probe = /ml_probe=1/.test(iframe.contentWindow?.document?.cookie || '');
        finish(!probe);
      } catch {
        // Acceso cross-origin bloqueado: también es señal de restricción.
        finish(true);
      }
    };

    document.body.appendChild(iframe);
  });
}

/**
 * Diagnóstico del login con Google para esta sesión.
 *
 * @returns {Promise<{ edge: boolean, storageBlocked: boolean, risky: boolean }>}
 */
export async function diagnoseGoogleLogin() {
  const edge = isEdge();
  const storageBlocked = await detectIframeStorageBlocked();
  return { edge, storageBlocked, risky: edge && storageBlocked };
}

/** Mensaje honesto y accionable cuando el login con Google no va a funcionar. */
export function googleLoginWarning(diag) {
  if (!diag?.risky) return null;
  return {
    title: 'El acceso con Google puede no funcionar en este navegador',
    body:
      'Edge está bloqueando el almacenamiento de las ventanas de Google ("Tracking Prevention"), que es lo que necesita el inicio de sesión para completarse. Podés continuar con Chrome o Firefox, o usar el acceso con correo y código que te mostramos abajo.',
  };
}