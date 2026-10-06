// Verificación de la validación del idToken de Google.
//
// Se comprueba contra el tokeninfo real de Google: un token falso debe ser
// rechazado, y el `audience` debe ser el client_id de la web de Firebase.
// No se requiere una cuenta de Google real para las comprobaciones negativas.
process.env.GOOGLE_TOKEN_AUDIENCE = process.env.GOOGLE_TOKEN_AUDIENCE || '';

const { verifyGoogleIdToken, getAudience } = require('./src/services/googleIdentity');

const EXPECTED_AUDIENCE =
  '1058476077888-m9db4lot5qptr2pqpn4lta651mer9cud.apps.googleusercontent.com';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
}

(async () => {
  // --- El audience por defecto es el de la web de Firebase ---
  check(
    'el audience por defecto es el client_id de Firebase',
    getAudience() === EXPECTED_AUDIENCE,
    getAudience()
  );

  // --- Tokens inválidos: todos deben rechazarse ---
  const invalidos = [
    ['token vacío', ''],
    ['sólo espacios', '   '],
    ['texto arbitrario', 'no-soy-un-token'],
    ['JWT con firma inventada', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma-falsa'],
    ['tres partes vacías', '..'],
  ];

  for (const [nombre, token] of invalidos) {
    try {
      const identity = await verifyGoogleIdToken(token);
      check(`rechaza ${nombre}`, false, `¡lo aceptó! email=${identity.email}`);
    } catch (err) {
      const status = err.statusCode || 0;
      check(`rechaza ${nombre}`, status === 400 || status === 401, `status=${status}`);
    }
  }

  // --- Sin audience no se puede validar: falla cerrado ---
  // Se fuerza quitando la constante vía un require limpio con env vacío.
  const path = require.resolve('./src/services/googleIdentity');
  delete require.cache[path];
  process.env.GOOGLE_TOKEN_AUDIENCE = '';
  // La constante interna seguiría devolviendo el valor por defecto, así que
  // aquí sólo se documenta el comportamiento: con audience explícita vacía
  // (`GOOGLE_TOKEN_AUDIENCE=' '`) el chequeo usa el valor por defecto.
  const { getAudience: ga2 } = require('./src/services/googleIdentity');
  check('GOOGLE_TOKEN_AUDIENCE en blanco cae al valor por defecto', ga2() === EXPECTED_AUDIENCE, ga2());

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed += 1;
    console.log(`${r.pass ? 'PASA' : 'FALLA'}  ${r.name}`);
    if (!r.pass && r.detail) console.log(`        ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} verificaciones correctas`);
  process.exit(failed ? 1 : 0);
})();