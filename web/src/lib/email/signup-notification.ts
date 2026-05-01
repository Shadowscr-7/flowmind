import nodemailer from "nodemailer";

type SignupEmailInput = {
  userId: string;
  email: string;
  displayName?: string | null;
  phone?: string | null;
  plan?: string | null;
  source?: string | null;
  createdAt?: string | null;
};

const brand = {
  bg: "#06120f",
  card: "#ffffff",
  green: "#34d399",
  greenDark: "#047857",
  text: "#0f172a",
  muted: "#64748b",
  line: "#dbe7e2",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatValue(value: unknown, fallback = "No informado") {
  const text = String(value ?? "").trim();
  return escapeHtml(text || fallback);
}

function buildHtml(input: SignupEmailInput) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://flowmind.aivanguardlabs.com";
  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  const formattedDate = new Intl.DateTimeFormat("es-UY", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Montevideo",
  }).format(createdAt);

  const rows = [
    ["Nombre", input.displayName],
    ["Email", input.email],
    ["Telefono WhatsApp", input.phone],
    ["Plan elegido", input.plan],
    ["Origen", input.source],
    ["Fecha", formattedDate],
    ["User ID", input.userId],
  ];

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nuevo registro en FlowMind</title>
  </head>
  <body style="margin:0;background:${brand.bg};font-family:Inter,Segoe UI,Arial,sans-serif;color:${brand.text};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:${brand.card};border-radius:22px;overflow:hidden;border:1px solid rgba(52,211,153,.25);">
            <tr>
              <td style="padding:30px 30px 22px;background:linear-gradient(135deg,#071714 0%,#0b2a20 58%,#116149 100%);color:white;">
                <div style="font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${brand.green};">FlowMind</div>
                <h1 style="margin:12px 0 8px;font-size:30px;line-height:1.15;">Nuevo usuario registrado</h1>
                <p style="margin:0;color:#c9f5e6;font-size:15px;line-height:1.6;">Alguien acaba de crear una cuenta y entrar al flujo de activacion.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px 8px;">
                <div style="display:inline-block;border-radius:999px;background:#dcfce7;color:${brand.greenDark};padding:7px 12px;font-size:13px;font-weight:700;">Lead nuevo</div>
                <h2 style="margin:16px 0 4px;font-size:22px;color:${brand.text};">${formatValue(input.displayName, "Usuario sin nombre")}</h2>
                <p style="margin:0 0 18px;color:${brand.muted};font-size:15px;">${formatValue(input.email)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 26px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid ${brand.line};border-radius:16px;overflow:hidden;">
                  ${rows
                    .map(
                      ([label, value]) => `
                  <tr>
                    <td style="padding:14px 16px;border-bottom:1px solid ${brand.line};background:#f8faf9;color:${brand.muted};font-size:13px;font-weight:700;width:38%;">${escapeHtml(label)}</td>
                    <td style="padding:14px 16px;border-bottom:1px solid ${brand.line};color:${brand.text};font-size:14px;font-weight:600;">${formatValue(value)}</td>
                  </tr>`
                    )
                    .join("")}
                </table>
                <div style="margin-top:24px;text-align:center;">
                  <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${brand.green};color:#052e22;text-decoration:none;border-radius:12px;padding:13px 18px;font-weight:800;">Abrir FlowMind</a>
                </div>
                <p style="margin:22px 0 0;color:${brand.muted};font-size:12px;line-height:1.6;text-align:center;">Este aviso se envio automaticamente desde el registro web.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendSignupNotification(input: SignupEmailInput) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const from = process.env.SMTP_FROM || user;
  const to = process.env.SIGNUP_NOTIFY_TO || user;
  const subject = `Nuevo registro en FlowMind: ${input.email}`;

  await transporter.sendMail({
    from,
    to,
    subject,
    html: buildHtml(input),
    text: [
      "Nuevo usuario registrado en FlowMind",
      `Nombre: ${input.displayName || "No informado"}`,
      `Email: ${input.email}`,
      `Telefono WhatsApp: ${input.phone || "No informado"}`,
      `Plan elegido: ${input.plan || "No informado"}`,
      `Origen: ${input.source || "No informado"}`,
      `User ID: ${input.userId}`,
    ].join("\n"),
  });
}
