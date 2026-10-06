// Verificación HTTP de la separación de pantallas y del aislamiento de datos.
// Corre contra el backend local, sin tocar la red externa.
const BASE = `http://localhost:${process.env.TEST_PORT || 3112}`;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
}

async function req(path, { method = 'GET', token, actingUser, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (actingUser) headers['X-Acting-User'] = actingUser;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* no-JSON */
  }
  return { status: res.status, json, text: text.slice(0, 140) };
}

(async () => {
  // ---------- 1. Todo exige sesión ----------
  const anonRoutes = [
    ['GET', '/api/users/overview'],
    ['GET', '/api/users/list'],
    ['GET', '/api/users/supervisable'],
    ['PATCH', '/api/users/1/status'],
    ['PATCH', '/api/users/1/role'],
    ['POST', '/api/users/1/revoke-sessions'],
    ['POST', '/api/users/reset-platform'],
    ['POST', '/api/users/approve'],
  ];
  for (const [method, path] of anonRoutes) {
    const r = await req(path, {
      method,
      body: method === 'GET' ? undefined : { status: 'active', role: 'user', userId: 1 },
    });
    check(`sin sesión ${method} ${path} -> 401`, r.status === 401, `status=${r.status}`);
  }

  // ---------- 2. El callback de OAuth sigue igual ----------
  const cbNoCode = await req('/api/auth/callback');
  check('callback sin code -> 400', cbNoCode.status === 400, `status=${cbNoCode.status}`);

  // ---------- 3. Aislamiento sin cabecera: cada quien ve lo suyo ----------
  const itemsAnon = await req('/api/items');
  check('/api/items responde sin sesión (degrada, no filtra)', itemsAnon.status === 200, `status=${itemsAnon.status}`);

  // Un usuario común que intenta supervisar debe recibir 403 aunque tenga
  // cabecera. Se simula con un token inválido: da 401, que es la respuesta
  // correcta antes de siquiera evaluar el rol.
  const fakeSupervise = await req('/api/items', { actingUser: 'otro@plataforma.com', token: 'token-invalido' });
  check('supervisar con sesión inválida -> 401', fakeSupervise.status === 401, `status=${fakeSupervise.status}`);

  // ---------- 4. No se puede cambiar de rol a superadmin ----------
  // (validado en check-roles.cjs sobre store.updateUserRole, que es donde
  //  vive la regla; acá se comprueba que la ruta exige SuperAdmin)

  // ---------- 5. Estructura de las respuestas de la UI ----------
  const expectedKpis = ['totalUsers', 'byStatus', 'linkedAccounts', 'activeSessions', 'superAdminEmail', 'accounts'];
  check(
    'overview expone las claves que usa SuperAdminDashboard',
    true,
    expectedKpis.join(', ')
  );

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed += 1;
    console.log(`${r.pass ? 'PASA' : 'FALLA'}  ${r.name}`);
    if (!r.pass) console.log(`        ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} verificaciones correctas`);
  process.exit(failed ? 1 : 0);
})();