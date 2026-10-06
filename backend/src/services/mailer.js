/**
 * Envío de correos de acceso.
 *
 * Sin transporte configurado no se finge el envío: `sendAccessCode` devuelve
 * `delivered: false` y el route expone el código en la respuesta para que el
 * usuario pueda entrar igual (modo acceso directo). Con `SMTP_URL` +
 * `SMTP_USER`/`SMTP_PASS` configurados, el código sale por correo.
 */

const SMTP_URL = String(process.env.SMTP_URL || '').trim();
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const MAIL_FROM = String(process.env.MAIL_FROM || SMTP_USER || 'no-reply@localhost').trim();

function isConfigured() {
  return Boolean(SMTP_URL);
}

async function sendAccessCode({ to, code, minutes = 15 }) {
  if (!isConfigured()) {
    return { delivered: false, reason: 'sin transporte de correo configurado' };
  }

  try {
    // `nodemailer` es opcional: si está disponible se usa, si no se avisa.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport(SMTP_URL, {
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });

    await transport.sendMail({
      from: MAIL_FROM,
      to,
      subject: `Tu código de acceso es ${code}`,
      text: `Tu código de acceso para entrar a la plataforma es: ${code}\n\nVence en ${minutes} minutos. Si no lo pediste, ignorá este mensaje.`,
      html: `<div style="font-family:system-ui,sans-serif;line-height:1.5">
  <p>Tu código de acceso para entrar a la plataforma es:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
  <p style="color:#555">Vence en ${minutes} minutos.</p>
  <p style="color:#888;font-size:12px">Si no lo pediste, ignorá este mensaje.</p>
</div>`,
    });

    return { delivered: true };
  } catch (err) {
    console.warn('mailer: no se pudo enviar el correo:', err.message);
    return { delivered: false, reason: err.message };
  }
}

module.exports = { isConfigured, sendAccessCode };