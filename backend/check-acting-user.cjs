// Verificación de `resolveActingUser`: la puerta que habilita a un Admin a
// operar la cuenta de otro usuario. Se prueban todos los rechazos, que es
// donde está el riesgo de aislamiento de datos.
process.env.ADMIN_EMAIL = 'dueno@plataforma.com';

const store = require('./src/db/store');
const { resolveActingUser } = require('./src/middleware/actingUser');
const { resolveMlEmail, resolveEffectiveOwnerEmail } = require('./src/middleware/mlContext');

// Se simulan las consultas al store sin tocar la base.
const USERS = {
  'dueno@plataforma.com': { id: 1, email: 'dueno@plataforma.com', role: 'admin', status: 'active' },
  'admin@plataforma.com': { id: 2, email: 'admin@plataforma.com', role: 'admin', status: 'active' },
  'user@plataforma.com': { id: 3, email: 'user@plataforma.com', role: 'user', status: 'active' },
  'suspendido@plataforma.com': { id: 4, email: 'suspendido@plataforma.com', role: 'user', status: 'suspended' },
  'pendiente@plataforma.com': { id: 5, email: 'pendiente@plataforma.com', role: 'user', status: 'pending' },
};

store.findUserByEmail = async (email) => USERS[String(email).toLowerCase()] || null;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
}

async function run(user, requestedEmail, useHeader = true) {
  const req = {
    user,
    query: useHeader ? {} : { actingUser: requestedEmail },
    get: (h) => (h.toLowerCase() === 'x-acting-user' && useHeader ? requestedEmail : ''),
  };
  let status = 0;
  let body = null;
  const res = {
    status(s) { status = s; return res; },
    json(b) { body = b; return res; },
  };
  let passed = false;
  await resolveActingUser(req, res, () => { passed = true; });
  return { passed, status, body, req };
}

(async () => {
  const owner = USERS['dueno@plataforma.com'];
  const admin = USERS['admin@plataforma.com'];
  const plain = USERS['user@plataforma.com'];

  // --- Casos que deben pasar ---
  const adminActs = await run(admin, 'user@plataforma.com');
  check('admin puede supervisar a un usuario', adminActs.passed, JSON.stringify(adminActs.body));
  check(
    'el contexto apunta a la cuenta supervisionada',
    resolveMlEmail(adminActs.req) === 'user@plataforma.com',
    resolveMlEmail(adminActs.req)
  );
  check(
    'ownerEmail también es la supervisionada',
    resolveEffectiveOwnerEmail(adminActs.req) === 'user@plataforma.com'
  );

  const ownerActs = await run(owner, 'admin@plataforma.com');
  check('superadmin puede supervisar a un admin', ownerActs.passed);

  const viaQuery = await run(admin, 'user@plataforma.com', false);
  check('también funciona por query param', viaQuery.passed);

  const self = await run(admin, 'admin@plataforma.com');
  check('supervisar la propia cuenta se ignora', self.passed && !self.req.actingUser);

  // --- Casos que deben rechazarse ---
  const userActs = await run(plain, 'admin@plataforma.com');
  check('un usuario NO puede supervisar', userActs.status === 403, JSON.stringify(userActs.body));
  check('y no cambia el contexto', resolveMlEmail(userActs.req) === 'user@plataforma.com');

  const noSession = await run(undefined, 'admin@plataforma.com');
  check('sin sesión NO puede supervisar', noSession.status === 401, JSON.stringify(noSession.body));

  const ghost = await run(admin, 'nadie@plataforma.com');
  check('cuenta inexistente -> 404', ghost.status === 404, JSON.stringify(ghost.body));

  const suspended = await run(admin, 'suspendido@plataforma.com');
  check('cuenta suspendida -> 403', suspended.status === 403, JSON.stringify(suspended.body));

  const pending = await run(admin, 'pendiente@plataforma.com');
  check('cuenta pendiente -> 403', pending.status === 403, JSON.stringify(pending.body));

  // --- Aislamiento: sin cabecera, cada quien ve lo suyo ---
  const plainNoHeader = { user: plain, query: {}, get: () => '' };
  check('sin cabecera, el usuario ve su cuenta', resolveMlEmail(plainNoHeader) === 'user@plataforma.com');
  const adminNoHeader = { user: admin, query: {}, get: () => '' };
  check('sin cabecera, el admin ve la suya', resolveMlEmail(adminNoHeader) === 'admin@plataforma.com');

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed += 1;
    console.log(`${r.pass ? 'PASA' : 'FALLA'}  ${r.name}`);
    if (!r.pass && r.detail) console.log(`        ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} verificaciones correctas`);
  process.exit(failed ? 1 : 0);
})();