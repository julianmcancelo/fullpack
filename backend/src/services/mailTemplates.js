/**
 * Plantillas HTML de los correos de la plataforma.
 *
 * Se construyen a mano (sin dependencias) porque son tres y ninguna necesita
 * motor de plantillas. Todo lo interpolado pasa por `escapeHtml`: los valores
 * vienen de usuarios (nombre, email) y no pueden inyectar marcado.
 */

const BRAND = {
  name: 'Plataforma',
  // Debe coincidir con el dominio que Resend tenga verificado.
  fromName: String(process.env.MAIL_FROM_NAME || 'Plataforma').trim(),
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout({ title, preheader = '', bodyHtml }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;border:1px solid #e6e8ec;overflow:hidden;">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#00b3a4,#7b5cf0);"></td>
          </tr>
          <tr>
            <td style="padding:32px 32px 12px;">
              <span style="display:inline-block;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#00b3a4;">${escapeHtml(BRAND.name)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#fafbfc;border-top:1px solid #eceef1;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#8b909a;">
                Este es un mensaje automático. Si no esperabas recibirlo, podés ignorarlo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Correo con el código de acceso de 6 dígitos. */
function accessCodeEmail({ code, minutes = 15 }) {
  const safeCode = escapeHtml(code);
  const title = `Tu código de acceso es ${code}`;
  return {
    subject: `${code} es tu código de acceso`,
    html: layout({
      title,
      preheader: `Tu código de acceso es ${code}. Vence en ${minutes} minutos.`,
      bodyHtml: `
        <h1 style="margin:0 0 6px;font-size:21px;line-height:1.3;font-weight:800;color:#14161a;">
          Tu código de acceso
        </h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#5b6270;">
          Ingresá este código para entrar a la plataforma. Vence en ${minutes} minutos.
        </p>
        <div style="background:#f6f7f9;border:1px solid #e6e8ec;border-radius:16px;padding:26px 20px;text-align:center;">
          <span style="display:block;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:.28em;color:#14161a;">${safeCode}</span>
        </div>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8b909a;">
          Si no pediste este código, no hagas nada: no pasa nada si alguien más tiene tu correo.
        </p>`,
    }),
    text: `Tu código de acceso es ${code}\n\nVence en ${minutes} minutos.\n\nSi no lo pediste, ignorá este mensaje.`,
  };
}

/** Aviso de que una cuenta pidió acceso a la plataforma. */
function accessRequestEmail({ email, name = '', roleLabel = 'Administrador de la plataforma' }) {
  const who = escapeHtml(name || email);
  const title = 'Nueva solicitud de acceso';
  return {
    subject: `Solicitud de acceso: ${email}`,
    html: layout({
      title,
      preheader: `${who} pidió acceso a la plataforma.`,
      bodyHtml: `
        <h1 style="margin:0 0 6px;font-size:21px;line-height:1.3;font-weight:800;color:#14161a;">
          Nueva solicitud de acceso
        </h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5b6270;">
          Alguien pidió entrar a la plataforma. Revisá la solicitud y decidí si la aprobás.
        </p>
        <div style="background:#f6f7f9;border:1px solid #e6e8ec;border-radius:16px;padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8b909a;">Solicitante</p>
          <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#14161a;">${who}</p>
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8b909a;">Correo</p>
          <p style="margin:0;font-size:14px;color:#5b6270;">${escapeHtml(email)}</p>
        </div>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#8b909a;">
          Recibido como ${escapeHtml(roleLabel)}. La cuenta queda inactiva hasta que la apruebes o rechaces.
        </p>`,
    }),
    text: `${who} (${email}) pidió acceso a la plataforma.\n\nLa cuenta queda inactiva hasta que la apruebes o rechaces.`,
  };
}

module.exports = { escapeHtml, layout, accessCodeEmail, accessRequestEmail, BRAND };