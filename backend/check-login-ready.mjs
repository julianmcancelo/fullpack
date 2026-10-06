const BASE = 'https://ml-manager-pro-jade.vercel.app';
const A = `${BASE}/api`;
const EMAIL = 'jcancelo.dev@gmail.com';

async function call(p, opts = {}, token = '') {
  const r = await fetch(`${A}${p}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const t = await r.text();
  let b; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
}

(async () => {
  console.log('=== CAMINO 1: correo + código ===');

  const r1 = await call('/users/request-code', {
    method: 'POST', body: JSON.stringify({ email: EMAIL, name: 'Julián' }),
  });
  const code = r1.body.code || r1.body.debugOtp;
  console.log('  request-code :', r1.status, '| código recibido:', code ? 'SÍ' : 'NO');

  const r2 = await call('/users/verify-code', {
    method: 'POST', body: JSON.stringify({ email: EMAIL, code }),
  });
  console.log('  verify-code  :', r2.status, '| success:', r2.body.success);

  const token = r2.body.token;
  console.log('  token        :', token ? 'OK' : 'NO');

  // Lo que la web hace apenas tiene usuario: pintar el dashboard.
  const r3 = await call('/users/me', {}, token);
  console.log('  users/me     :', r3.status, '|', r3.body.user?.email, '| rol:', r3.body.user?.role);

  const r4 = await call('/stats/dashboard', {}, token);
  console.log('  stats        :', r4.status);

  const r5 = await call('/items', {}, token);
  console.log('  items        :', r5.status);

  const r6 = await call('/shipments', {}, token);
  console.log('  shipments    :', r6.status);

  const r7 = await call('/questions', {}, token);
  console.log('  questions    :', r7.status);

  const r8 = await call('/auth/status', {}, token);
  console.log('  auth/status  :', r8.status, '| connected:', r8.body.connected);

  const r9 = await call('/users/overview', {}, token);
  console.log('  overview     :', r9.status, '| usuarios:', r9.body.totalUsers);

  const r10 = await call('/settings', {}, token);
  console.log('  settings     :', r10.status);

  console.log('\n=== CAMINO 2: Google (depende del navegador) ===');
  const r11 = await call('/users/google-login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, name: 'Julián', avatar: '', googleId: `g${Date.now()}` }),
  });
  console.log('  google-login :', r11.status, '| token:', r11.body.token ? 'OK' : 'NO');
})();