# Spec minima (inline orquestador): Fix Supabase confirmation email

## Pedido literal
El mail de confirmacion de correo de Supabase tiene diseno espantoso y al confirmar redirige a localhost:3000.

## Sintoma reportado
1. Email de confirmacion sin diseño branded - usa template default de Supabase.
2. URL de confirmacion tiene `redirect_to=http://localhost:3000` en lugar de produccion.
   Evidencia: `https://kiubkipfzpnsnntjkxes.supabase.co/auth/v1/verify?...&redirect_to=http://localhost:3000`

## Acceptance criteria
- [ ] config.toml tiene `site_url = "https://flowmind.aivanguardlabs.com"`
- [ ] Existe backend/supabase/email-templates/confirm-signup.html con diseño branded
- [ ] El template usa colores de la web: fondo #0b0f12, acento #34d399 (emerald-400)
- [ ] El template incluye logo de FlowMind
- [ ] El template tiene boton CTA con {{ .ConfirmationURL }} de Supabase
- [ ] El template es compatible con clientes de email (inline CSS, tabla-based layout)

## Areas afectadas
- backend/supabase/config.toml (fix site_url)
- backend/supabase/email-templates/confirm-signup.html (crear)
