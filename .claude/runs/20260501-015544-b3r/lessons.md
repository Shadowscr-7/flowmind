# Lessons — 20260501-015544-b3r

## Pedido
Fix: usuario se crea antes de elegir plan + email template custom no se aplica en Supabase hosteado.

## Bucket inicial
bug-fix

## Resumen del path
triage (inline) -> implementer (inline) -> code-reviewer (inline) -> APPROVED

## Patrones detectados
- Cuando PaywallScreen se usa como paso OBLIGATORIO en el flujo de signup, agregar
  un param `fromSignup: bool` es el patron correcto para controlar la navegacion
  sin romper el uso existente como modal opcional.
- Para flujos de onboarding con paywall obligatorio: usar `pushReplacementNamed`
  desde el paywall (no `push`) evita que el boton back del SO regrese al signup.
- El template de email de Supabase hosteado requiere pegado MANUAL en el Dashboard
  (Authentication > Email Templates) aunque el archivo exista en el repo y config.toml
  lo referencie. config.toml solo aplica al CLI local (supabase start).
- Para cambiar el remitente de noreply@mail.app.supabase.io se necesita configurar
  SMTP custom en Project Settings > Auth > SMTP Settings del Dashboard.

## Metrica clave
- Iteraciones: 1
- Tokens totales estimados: 11000
- Costo estimado: $0.07
- Escalacion al arbiter: no
- Escalacion al humano: no
