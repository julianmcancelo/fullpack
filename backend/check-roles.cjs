// Verificación de la separación de roles SuperAdmin / Admin / user.
// No toca la red: se prueban las funciones de rol del store y los guards.
process.env.ADMIN_EMAIL = 'dueno@plataforma.com';

const store = require('./src/db/store');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
}

// --- effectiveRole ---
check(
  'ADMIN_EMAIL resuelve a superadmin aunque el registro diga admin',
  store.effectiveRole({ email: 'DUENO@plataforma.com', role: 'admin' }) === 'superadmin',
  store.effectiveRole({ email: 'dueno@plataforma.com', role: 'admin' })
);
check(
  'rol admin guardado se respeta como admin',
  store.effectiveRole({ email: 'otro@plataforma.com', role: 'admin' }) === 'admin',
  store.effectiveRole({ email: 'otro@plataforma.com', role: 'admin' })
);
check(
  'rol desconocido cae a user',
  store.effectiveRole({ email: 'x@y.com', role: 'inventado' }) === 'user',
  store.effectiveRole({ email: 'x@y.com', role: 'inventado' })
);
check(
  'usuario sin rol cae a user',
  store.effectiveRole({ email: 'x@y.com' }) === 'user',
  store.effectiveRole({ email: 'x@y.com' })
);

// --- isSupervisor: quién entra a supervisión ---
check('superadmin supervisa', store.isSupervisor({ email: 'dueno@plataforma.com', role: 'admin' }));
check('admin supervisa', store.isSupervisor({ email: 'otro@plataforma.com', role: 'admin' }));
check('user NO supervisa', !store.isSupervisor({ email: 'user@plataforma.com', role: 'user' }));
check('sin rol NO supervisa', !store.isSupervisor({ email: 'nuevo@plataforma.com' }));

// --- isSuperAdminEmail: sólo el dueño ---
check('dueño es superadmin', store.isSuperAdminEmail('dueno@plataforma.com'));
check('case-insensitive en el email', store.isSuperAdminEmail('  Dueno@Plataforma.COM '));
check('admin normal NO es superadmin', !store.isSuperAdminEmail('otro@plataforma.com'));
check('alias isAdminEmail apunta al dueño', store.isAdminEmail('dueno@plataforma.com') === true);

// --- guards de express: requireSuperAdmin vs requireAdmin ---
const { requireAdmin, requireSuperAdmin } = require('./src/middleware/session');

function runGuard(guard, user) {
  let status = 0;
  let body = null;
  const req = { user, headers: {}, get: () => '' };
  const res = {
    status(s) {
      status = s;
      return res;
    },
    json(b) {
      body = b;
      return res;
    },
  };
  let passed = false;
  guard(req, res, () => {
    passed = true;
  });
  return { passed, status, body };
}

const owner = { email: 'dueno@plataforma.com', role: 'admin' };
const admin = { email: 'otro@plataforma.com', role: 'admin' };
const plain = { email: 'user@plataforma.com', role: 'user' };

check('requireSuperAdmin deja pasar al dueño', runGuard(requireSuperAdmin, owner).passed);
check(
  'requireSuperAdmin bloquea al admin',
  runGuard(requireSuperAdmin, admin).status === 403,
  JSON.stringify(runGuard(requireSuperAdmin, admin).body)
);
check(
  'requireSuperAdmin bloquea al usuario',
  runGuard(requireSuperAdmin, plain).status === 403
);
check('requireAdmin deja pasar al admin', runGuard(requireAdmin, admin).passed);
check('requireAdmin deja pasar al dueño', runGuard(requireAdmin, owner).passed);
check(
  'requireAdmin bloquea al usuario',
  runGuard(requireAdmin, plain).status === 403,
  JSON.stringify(runGuard(requireAdmin, plain).body)
);

let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? 'PASA' : 'FALLA'}  ${r.name}`);
  if (!r.pass && r.detail) console.log(`        ${r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} verificaciones correctas`);
process.exit(failed ? 1 : 0);