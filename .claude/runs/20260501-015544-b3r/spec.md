# Spec minima (inline orquestador): Fix signup flow + email template advisory

## Pedido literal
El usuario deberia ser creado despues de elegir un plan ya sea pagando, o el plan free...
pero no antes. El email de confirmacion sigue llegando con template default de Supabase.

## Sintoma reportado
1. El email de confirmacion llega con el template default de Supabase (sin diseño custom)
   aunque el template HTML custom ya existe en el repo.
2. Despues del signup, el usuario es llevado directamente al onboarding sin pasar
   por el paywall (eleccion de plan free o pago).

## Acceptance criteria
- [ ] El flujo post-signup navega a PaywallScreen antes que al OnboardingScreen
- [ ] El usuario puede elegir plan (free o pago) antes de continuar al onboarding
- [ ] Desde PaywallScreen, tanto "comprar" como "continuar gratis" llevan al onboarding
- [ ] El developer recibe instrucciones claras para aplicar el template en el Dashboard de Supabase

## Areas afectadas
- `app/lib/presentation/screens/auth/signup_screen.dart`: cambiar destino de navegacion post-signup
- `app/lib/presentation/screens/subscription/paywall_screen.dart`: verificar que tiene salida a onboarding
- `backend/supabase/email-templates/confirm-signup.html`: ya correcto, no cambiar
- `backend/supabase/config.toml`: ya correcto, no cambiar

## Nota sobre el email
El template custom YA esta en el repo y config.toml lo referencia. El problema es que
para proyectos Supabase HOSTEADOS (no CLI local), el template HTML debe pegarse
manualmente en: Dashboard > Authentication > Email Templates > Confirm signup.
Esto NO es un cambio de codigo — es una accion manual del developer.
