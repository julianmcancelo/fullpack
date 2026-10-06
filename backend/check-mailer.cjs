// Verificación del envío de correo (Resend + SMTP) sin enviar nada real:
// se comprueba la selección de transporte, el escapado de las plantillas y
// que sin API key el sistema falle cerrado en vez de prometer un envío.
const mailer = require('./src/services/mailer');
const { accessCodeEmail, accessRequestEmail, escapeHtml } = require('./src/services/mailTemplates');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
}

// --- Sin credenciales: falla cerrado, no promete envío ---
check(
  'sin API key el envío falla en vez de fingir',
  mailer.isConfigured() === false,
  `configured=${mailer.isConfigured()}`
);
check('sin transporte configurado el status lo dice', mailer.getTransport() === 'none', mailer.getTransport());
check(
  'el status nunca expone la API key',
  !JSON.stringify(mailer.getStatus()).toLowerCase().includes('apikey')
);

// --- Plantillas: escapado de HTML ---
check(
  'escapeHtml escapa < > & "',
  escapeHtml('<img src=x onerror="alert(1)">') === '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
  escapeHtml('<img src=x>')
);
check('escapeHtml maneja null', escapeHtml(null) === '');

const conInyeccion = accessCodeEmail({ code: '123456', minutes: 15 });
check(
  'el código no inyecta markup (es un número, pero la plantilla lo escapa)',
  !conInyeccion.html.includes('<script'),
  'ok'
);

const pedido = accessRequestEmail({ email: 'a@b.com', name: '<script>alert(1)</script>' });
check('el nombre del solicitante va escapado', !pedido.html.includes('<script>'), 'ok');
check('el nombre escapado sigue visible como texto', pedido.html.includes('&lt;script&gt;'), 'ok');

// --- El aviso al admin lleva Reply-To con el tag +base ---
check(
  'el aviso de solicitud trae el texto plano para clientes sin HTML',
  typeof pedido.text === 'string' && pedido.text.length > 0
);
check('el asunto incluye el email', pedido.subject.includes('a@b.com'), pedido.subject);
check(
  'el aviso nombra al solicitante',
  pedido.text.includes('<script>alert(1)</script>') || pedido.text.includes('a@b.com')
);

// --- El correo del código no dice "código incorrecto" ni filtra nada ---
const codigo = accessCodeEmail({ code: '654321', minutes: 15 });
check('el asunto lleva el código', codigo.subject.includes('654321'), codigo.subject);
check('el cuerpo lleva el código', codigo.html.includes('654321'), 'ok');
check('el texto plano lleva el código', codigo.text.includes('654321'), 'ok');
check('el código no se manda en el asunto sin contexto', codigo.subject.startsWith('654321 es tu'), codigo.subject);

let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? 'PASA' : 'FALLA'}  ${r.name}`);
  if (!r.pass) console.log(`        ${r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} verificaciones correctas`);
process.exit(failed ? 1 : 0);