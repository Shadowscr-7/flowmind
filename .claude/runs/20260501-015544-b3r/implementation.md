# Implementation — 20260501-015544-b3r

## Cambios realizados

### 1. signup_screen.dart — Redireccion post-signup al paywall
Linea ~86: cambio de `AppRouter.onboarding` a `AppRouter.paywall` con argumento
`fromSignup: true`. El flujo ahora es: signup exitoso -> paywall (elegir plan) -> onboarding.

### 2. paywall_screen.dart — Soporte para flujo de signup
- Nuevo param `fromSignup: bool` (default false — backward compatible)
- Nuevo metodo `_proceed({bool purchased})`: si `fromSignup=true` hace
  `pushReplacementNamed(onboarding)`, sino `pop(purchased)` como antes.
- Boton de cierre cambia segun contexto: en signup muestra "Continuar gratis",
  en uso normal sigue siendo el icono X.
- `_handlePurchase` y `_handleRestore` ahora llaman `_proceed()` en lugar de
  `Navigator.pop()` directamente.
- Import agregado: `app_router.dart`

### 3. app_router.dart — Pasaje del argumento fromSignup a PaywallScreen
Extrae `args['fromSignup']` del mapa de argumentos y lo pasa al constructor.
Default false preserva comportamiento existente para todos los callers.

## Sobre el email template
El template HTML custom YA EXISTE en `backend/supabase/email-templates/confirm-signup.html`
y config.toml lo referencia correctamente. El problema es que en proyectos HOSTEADOS
de Supabase, el template debe aplicarse manualmente en el Dashboard.

ACCION MANUAL REQUERIDA:
1. Ir a https://app.supabase.com > tu proyecto > Authentication > Email Templates
2. Seleccionar "Confirm signup"
3. Pegar el contenido de `backend/supabase/email-templates/confirm-signup.html`
4. Verificar que el "From" sea el dominio configurado (o configurar SMTP custom
   en Project Settings > Auth > SMTP Settings para dejar de usar noreply@mail.app.supabase.io)
