# Orchestrator Report — 20260501-013637-a7m

## Dos bugs resueltos

### Bug 1: redirect_to=localhost:3000
**Causa raiz:** `config.toml` tenia `site_url = "http://127.0.0.1:3000"` (local dev).
**Fix local:** actualizado a `site_url = "https://flowmind.aivanguardlabs.com"` + localhost
  preservado en `additional_redirect_urls` para seguir desarrollando localmente.

**ACCION MANUAL REQUERIDA en Supabase Dashboard (instancia hosteada):**
1. Ir a https://supabase.com/dashboard/project/kiubkipfzpnsnntjkxes/auth/url-configuration
2. Cambiar "Site URL" a: https://flowmind.aivanguardlabs.com
3. Agregar a "Redirect URLs": http://localhost:3000 (para dev local)

### Bug 2: Email sin diseño
**Fix:** Creado `backend/supabase/email-templates/confirm-signup.html`
- Fondo oscuro #0b0f12 (igual que /login y /register)
- Acento emerald #34d399
- Logo desde https://flowmind.aivanguardlabs.com/images/logo.png
- CTA prominente con {{ .ConfirmationURL }}
- CSS inline para compatibilidad con clientes de email
- Subject: "Confirma tu email — FlowMind"

**ACCION MANUAL REQUERIDA en Supabase Dashboard:**
1. Ir a https://supabase.com/dashboard/project/kiubkipfzpnsnntjkxes/auth/templates
2. Seleccionar "Confirm signup"
3. Subject: Confirma tu email — FlowMind
4. Pegar contenido de backend/supabase/email-templates/confirm-signup.html en el editor

El config.toml tambien tiene `[auth.email.template.confirmation]` para que el CLI
local use el template automaticamente con `supabase start`.

## Commit sugerido
git add backend/supabase/config.toml backend/supabase/email-templates/confirm-signup.html
git commit -m "fix: Supabase email template branded + redirect URL a produccion"
