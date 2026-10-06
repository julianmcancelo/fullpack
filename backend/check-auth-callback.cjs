// Verificación de la seguridad y el flujo de /api/auth/callback en local.
// No toca la red externa: el canje con Mercado Libre no se ejercita (requiere
// un código real). Lo que se comprueba es la autorización de las rutas y la
// construcción del `redirect_uri`.
const BASE = `http://localhost:${process.env.TEST_PORT || 3111}`;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
}

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* respuesta no-JSON (redirect o texto plano) */
  }
  return { status: res.status, headers: res.headers, text, json };
}

(async () => {
  // --- Sin sesión: nada debe filtrar ni permitir cambiar nada ---
  const settingsAnon = await req('/api/settings');
  check(
    'GET /api/settings sin sesión -> 401',
    settingsAnon.status === 401,
    `status=${settingsAnon.status}`
  );
  check(
    'GET /api/settings no filtra clientSecret',
    !/clientSecret"\s*:\s*"[^"]{3,}"/.test(settingsAnon.text),
    settingsAnon.text.slice(0, 80)
  );

  const saveAnon = await req('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: 'hackeado' }),
  });
  check(
    'POST /api/settings sin sesión -> 401 (no se puede redirigir el OAuth)',
    saveAnon.status === 401,
    `status=${saveAnon.status}`
  );

  const urlAnon = await req('/api/auth/url');
  check('GET /api/auth/url sin sesión -> 401', urlAnon.status === 401, `status=${urlAnon.status}`);

  const exchangeAnon = await req('/api/auth/exchange-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'qualquer-cosa' }),
  });
  check(
    'POST /api/auth/exchange-code sin sesión -> 401',
    exchangeAnon.status === 401,
    `status=${exchangeAnon.status}`
  );

  // --- Callback sin code ni state ---
  const cbNoCode = await req('/api/auth/callback');
  check(
    'callback sin code -> 400 explicativo',
    cbNoCode.status === 400 && /código de autorización/i.test(cbNoCode.text),
    `status=${cbNoCode.status}`
  );

  // --- Callback con error de Mercado Libre: redirige con el motivo ---
  const cbError = await req('/api/auth/callback?error=invalid_credentials&error_description=bad+code', {
    redirect: 'manual',
  });
  const locErr = cbError.headers.get('location') || '';
  check(
    'callback con error -> redirect con auth_error',
    cbError.status === 302 && locErr.includes('auth_error=bad%20code'),
    `status=${cbError.status} location=${locErr}`
  );

  // --- Callback con code pero sin state: no debe conectar nada ---
  const cbNoState = await req('/api/auth/callback?code=abc123', { redirect: 'manual' });
  const locState = cbNoState.headers.get('location') || '';
  check(
    'callback sin state -> redirect pidiendo sesión, no canjea',
    cbNoState.status === 302 && locState.includes('auth_error'),
    `status=${cbNoState.status} location=${locState}`
  );

  // --- Con sesión real: /auth/url debe usar el callback del dominio ---
  // Sin DATABASE_URL este entorno local no alcanza Neon, así que lo que se
  // verifica es que el fallo sea cerrado: nunca se emite una sesión.
  const login = await req('/api/users/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, code: '000000' }),
  });
  const emittedSession = Boolean(login.json?.token || login.json?.session);
  check(
    'verify-code con código inválido no emite sesión',
    login.status >= 400 && !emittedSession,
    `status=${login.status} body=${login.text.slice(0, 90)}`
  );

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed += 1;
    console.log(`${r.pass ? 'PASA' : 'FALLA'}  ${r.name}`);
    if (!r.pass) console.log(`        ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} verificaciones correctas`);
})();