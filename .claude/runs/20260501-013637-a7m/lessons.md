# Lessons — 20260501-013637-a7m

## Pedido
Fix email confirmacion Supabase: diseno espantoso + redirect a localhost.

## Bucket inicial
bug-fix

## Resumen del path
triage (inline) → implementer (inline) → code-reviewer (inline) → APPROVED

## Patrones detectados
- config.toml site_url afecta solo CLI local. Para instancia hosteada, el fix DEBE
  hacerse TAMBIEN en el Supabase Dashboard (Authentication > URL Configuration).
- Email templates de Supabase en proyectos hosteados requieren pegado manual en Dashboard
  ademas del config.toml (que solo aplica al CLI local).
- Emails HTML para Supabase: usar Go template {{ .ConfirmationURL }}, no Liquid ni Jinja.

## Metrica clave
- Iteraciones: 1
- Tokens totales estimados: 8900
- Costo estimado: $0.06
- Escalacion al arbiter: no
- Escalacion al humano: no
