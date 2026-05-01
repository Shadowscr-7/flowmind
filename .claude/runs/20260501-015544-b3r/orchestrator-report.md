# Orchestrator Report — 20260501-015544-b3r

## Problema 1: Flujo de signup (RESUELTO en codigo)

### Causa raiz
En `signup_screen.dart`, despues del `authService.signUp()` exitoso, el codigo
navegaba directamente a `AppRouter.onboarding`. El `PaywallScreen` existia pero
nunca era mostrado en el flujo de registro.

### Solucion implementada
3 archivos modificados:

1. **signup_screen.dart** (linea ~86):
   - Antes: `Navigator.pushReplacementNamed(context, AppRouter.onboarding)`
   - Despues: `Navigator.pushReplacementNamed(context, AppRouter.paywall, arguments: const {'fromSignup': true})`

2. **paywall_screen.dart**:
   - Agregado param `fromSignup: bool` (default `false` — backward compatible)
   - Agregado metodo `_proceed()` que navega a onboarding si `fromSignup=true`, sino pop
   - Boton de cierre muestra "Continuar gratis" en modo signup (mas claro para el usuario)
   - `_handlePurchase` y `_handleRestore` usan `_proceed()` en vez de `Navigator.pop()`

3. **app_router.dart**:
   - Extrae `args['fromSignup']` y lo pasa al constructor de `PaywallScreen`

### Flujo resultante
signup -> paywall (elegir plan / "Continuar gratis") -> onboarding

---

## Problema 2: Email template custom no se aplica (ACCION MANUAL)

### Por que el template custom NO llega aunque este en el repo

El archivo `backend/supabase/email-templates/confirm-signup.html` y la referencia
en `config.toml` ([auth.email.template.confirmation]) SOLO aplican cuando se usa
**Supabase CLI local** (`supabase start`). El proyecto hosteado en app.supabase.com
ignora esos archivos — tiene su propio sistema de templates independiente.

### Pasos para aplicar el template custom en Supabase hosteado

1. Ir a https://app.supabase.com > tu proyecto
2. Ir a Authentication > Email Templates
3. Seleccionar "Confirm signup" en el menu lateral
4. Pegar el contenido de `backend/supabase/email-templates/confirm-signup.html`
5. Guardar

### Para cambiar el remitente (noreply@mail.app.supabase.io)

Para usar un dominio propio como remitente:
1. Ir a Project Settings > Auth > SMTP Settings
2. Activar "Custom SMTP"
3. Configurar host, port, user, password del servicio SMTP (Resend, SendGrid, etc.)
4. El "From" puede ser hola@flowmind.aivanguardlabs.com o similar

Sin SMTP custom, los emails seguiran saliendo desde noreply@mail.app.supabase.io.

---

## Commit sugerido

```
git add app/lib/presentation/screens/auth/signup_screen.dart \
        app/lib/presentation/screens/subscription/paywall_screen.dart \
        app/lib/core/router/app_router.dart

git commit -m "feat: show paywall before onboarding in signup flow

New users now choose a plan (free or Pro) immediately after account
creation, before the onboarding wizard. PaywallScreen gains a
fromSignup param that redirects to onboarding instead of popping."
```
