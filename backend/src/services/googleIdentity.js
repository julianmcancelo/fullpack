const axios = require('axios');

/**
 * Verificación de la identidad de Google.
 *
 * El backend NO confía en el cuerpo del POST: recibe el `idToken` que emite
 * Firebase y lo valida contra el endpoint de Google. El email sale de ahí, no
 * de lo que mande el cliente.
 *
 * Por qué importa: antes, `POST /api/users/google-login` tomaba el email del
 * cuerpo sin comprobar nada. Con un simple POST `{"email":"<admin>"}` se
 * obtenía un token de sesión válido de esa persona, sin contraseña y sin
 * cuenta de Google.
 *
 * Se usa `tokeninfo` (GET, sin consumo de cuota) en vez de `verifyIdToken` porque
 * no necesita cliente de service account configurado: alcanza con el
 * `audience` del proyecto de Firebase, que ya está en el código del frontend.
 */

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

// El `audience` esperado es el client_id OAuth de la web de Firebase.
// Antes se deducía de un env var; ahora se deduce del propio código del
// frontend (`firebase.js`), que es la fuente de verdad y ya está en el repo.
// Si ese archivo cambia, hay que actualizar esta constante.
const FIREBASE_WEB_CLIENT_ID =
  '1058476077888-m9db4lot5qptr2pqpn4lta651mer9cud.apps.googleusercontent.com';

function getAudience() {
  const explicit = String(process.env.GOOGLE_TOKEN_AUDIENCE || '').trim();
  if (explicit) return explicit;
  return FIREBASE_WEB_CLIENT_ID;
}

/**
 * Valida un `idToken` de Google/Firebase y devuelve la identidad real.
 *
 * @param {string} idToken
 * @returns {Promise<{ email: string, name: string, picture: string, sub: string }>}
 * @throws {Error} con mensaje apto para mostrar al usuario
 */
async function verifyGoogleIdToken(idToken) {
  const token = String(idToken || '').trim();
  if (!token) {
    throw Object.assign(new Error('Falta la credencial de Google.'), { statusCode: 400 });
  }

  const audience = getAudience();
  if (!audience) {
    // Fallar cerrado: sin audience no se puede comprobar para qué app es el
    // token, y aceptarlo sería volver al mismo agujero.
    console.error('[auth] Falta GOOGLE_TOKEN_AUDIENCE: no se puede verificar Google.');
    throw Object.assign(
      new Error('El acceso con Google no está disponible en este momento.'),
      { statusCode: 503 }
    );
  }

  let data;
  try {
    const res = await axios.get(`${TOKENINFO_URL}?id_token=${encodeURIComponent(token)}`, {
      timeout: 8000,
    });
    data = res.data;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.response?.data?.error;
    console.warn('[auth] Google rechazó el idToken:', msg || err.message);
    throw Object.assign(new Error('No pudimos validar tu acceso con Google.'), {
      statusCode: 401,
    });
  }

  if (!data.email) {
    throw Object.assign(new Error('La cuenta de Google no tiene un email disponible.'), {
      statusCode: 401,
    });
  }

  // El token puede ser válido para otra aplicación (otro proyecto Firebase).
  // Sin esta comprobación, un atacante con un token propio de Google de otro
  // proyecto podría entrar a esta plataforma.
  if (data.aud && data.aud !== audience) {
    console.warn('[auth] idToken con audience distinta:', data.aud);
    throw Object.assign(new Error('La credencial de Google no es válida para esta plataforma.'), {
      statusCode: 401,
    });
  }

  return {
    email: String(data.email).trim().toLowerCase(),
    name: String(data.name || data.email).trim(),
    picture: String(data.picture || ''),
    sub: String(data.sub || data.user_id || ''),
  };
}

module.exports = { verifyGoogleIdToken, getAudience };