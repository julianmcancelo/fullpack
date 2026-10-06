// Verificación de la resolución de origen público y redirect_uri de OAuth.
// Se simulan las cabeceras que Vercel reenvía, sin tocar la red.
const Module = require('module');
const originalLoad = Module._load;

// Se intercepta `getSettings` para probar cada escenario sin depender de Neon
// ni de la configuración real guardada.
let fakeSettings = { appId: '123', clientSecret: 'shh', redirectUri: '' };
Module._load = function (request, parent) {
  if (parent && parent.filename && parent.filename.includes('oauthOrigin.js') && request === '../db/store') {
    return { getSettings: () => fakeSettings };
  }
  return originalLoad.apply(this, arguments);
};

const { resolveRedirectUri, getPostAuthRedirect } = require('./src/services/oauthOrigin');

function makeReq(headers) {
  return { headers: headers || {} };
}

const cases = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  cases.push({ name, pass, actual, expected });
}

// 1) Producción en Vercel: cabeceras de proxy, redirect vacío en ajustes.
delete process.env.ML_REDIRECT_URI;
delete process.env.ML_PUBLIC_URL;
fakeSettings = { appId: '123', clientSecret: 'shh', redirectUri: '' };
check(
  'origen desde x-forwarded-* (Vercel prod)',
  resolveRedirectUri(makeReq({ 'x-forwarded-proto': 'https', host: 'ml-manager-pro-jade.vercel.app' })),
  'https://ml-manager-pro-jade.vercel.app/api/auth/callback'
);

// 2) Preview deployment: mismo origen, otro host.
check(
  'callback sigue al host del preview',
  resolveRedirectUri(makeReq({ 'x-forwarded-proto': 'https', host: 'ml-manager-abc.vercel.app' })),
  'https://ml-manager-abc.vercel.app/api/auth/callback'
);

// 3) El placeholder httpbin NUNCA debe llegar a Mercado Libre.
fakeSettings = { appId: '123', clientSecret: 'shh', redirectUri: 'https://httpbin.org/get' };
check(
  'placeholder httpbin se ignora',
  resolveRedirectUri(makeReq({ 'x-forwarded-proto': 'https', host: 'app.vercel.app' })),
  'https://app.vercel.app/api/auth/callback'
);

// 4) Un redirectUri real y guardado se respeta.
fakeSettings = { appId: '123', clientSecret: 'shh', redirectUri: 'https://miapp.com/oauth/ml' };
check(
  'redirectUri guardado y válido se respeta',
  resolveRedirectUri(makeReq({ host: 'otro.vercel.app' })),
  'https://miapp.com/oauth/ml'
);

// 5) Env var gana sobre todo.
process.env.ML_REDIRECT_URI = 'https://env.vercel.app/api/auth/callback';
check(
  'ML_REDIRECT_URI tiene prioridad',
  resolveRedirectUri(makeReq({ host: 'otro.vercel.app' })),
  'https://env.vercel.app/api/auth/callback'
);

// 5b) Un placeholder en la env var tampoco vale: fue lo que dejó el flujo sin
// conectar en producción, así que no puede ganar por ser "explícito".
process.env.ML_REDIRECT_URI = 'https://httpbin.org/get';
fakeSettings = { appId: '123', clientSecret: 'shh', redirectUri: '' };
check(
  'ML_REDIRECT_URI con placeholder se descarta',
  resolveRedirectUri(makeReq({ 'x-forwarded-proto': 'https', host: 'app.vercel.app' })),
  'https://app.vercel.app/api/auth/callback'
);
delete process.env.ML_REDIRECT_URI;

// 6) Localhost usa http.
fakeSettings = { appId: '123', clientSecret: 'shh', redirectUri: '' };
check(
  'localhost usa http',
  resolveRedirectUri(makeReq({ host: 'localhost:3001' })),
  'http://localhost:3001/api/auth/callback'
);

// 7) Redirección posterior: éxito y error.
check(
  'redirect de éxito',
  getPostAuthRedirect(makeReq({ 'x-forwarded-proto': 'https', host: 'app.vercel.app' }), { success: true }),
  'https://app.vercel.app/?auth_success=1'
);
check(
  'redirect de error codificado',
  getPostAuthRedirect(makeReq({ 'x-forwarded-proto': 'https', host: 'app.vercel.app' }), { error: 'code inválido' }),
  'https://app.vercel.app/?auth_error=code%20inv%C3%A1lido'
);

// 8) Sin host no hay origin que derivar: se devuelve vacío sin romper.
check('sin host no hay redirect_uri', resolveRedirectUri(makeReq({})), '');

Module._load = originalLoad;

let failed = 0;
for (const c of cases) {
  if (!c.pass) failed += 1;
  console.log(`${c.pass ? 'PASA' : 'FALLA'}  ${c.name}`);
  if (!c.pass) console.log(`        esperado: ${c.expected}\n        obtenido: ${c.actual}`);
}
console.log(`\n${cases.length - failed}/${cases.length} escenarios correctos`);
process.exit(failed ? 1 : 0);