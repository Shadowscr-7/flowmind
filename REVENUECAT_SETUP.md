# RevenueCat Setup Guide — Flowmind Pro

## API Key (from your dashboard)

```
test_X0BAzzQkdFixeGSvxbtzM0vvxHp
```

---

## 1. Configurar RevenueCat Dashboard

1. Ve a [https://app.revenuecat.com](https://app.revenuecat.com) (ya tienes cuenta creada)
2. Crea un proyecto **Flowmind** si no existe
3. Agrega tu app de **Google Play**:
   - Package name: `com.flowmind.app` (verifica en `android/app/build.gradle.kts`)
   - Sube las **Service Account Credentials** (JSON key de Google Cloud)

## 2. Crear productos en Google Play Console

Ve a [Google Play Console](https://play.google.com/console) → Tu App → Monetize → Products → Subscriptions:

| Product ID | Tipo | Precio | Período |
|---|---|---|---|
| `flowmind_pro_monthly` | Subscription | $4.99 | Mensual |
| `flowmind_pro_yearly` | Subscription | $39.99 | Anual |

> Ambos productos deben estar en estado **Active**.

## 3. Configurar Entitlements en RevenueCat

1. Dashboard → Project → **Entitlements** → Create New
   - Identifier: `pro`
   - Asociar ambos productos (`flowmind_pro_monthly` + `flowmind_pro_yearly`)

## 4. Configurar Offerings en RevenueCat

1. Dashboard → **Offerings** → Create New
   - Identifier: `default` (debe ser el "Current Offering")
   - Agregar 2 packages:
     - **Monthly** → `flowmind_pro_monthly`
     - **Annual** → `flowmind_pro_yearly`

## 5. Configurar API Key en la app

Tu API key pública es:
```
test_X0BAzzQkdFixeGSvxbtzM0vvxHp
```

### Opción A: Variable de entorno (recomendado para producción)
```bash
flutter run --dart-define=REVENUECAT_API_KEY=test_X0BAzzQkdFixeGSvxbtzM0vvxHp
```

### Opción B: Hardcode directo (solo para pruebas)
Editar `app/lib/services/revenuecat_service.dart`, línea de `RevenueCatConfig.apiKey`:
```dart
static const String apiKey = 'test_X0BAzzQkdFixeGSvxbtzM0vvxHp';
```

## 6. Configurar Webhook en Supabase

### 6a. Agregar secret en Supabase Edge Functions
```bash
supabase secrets set REVENUECAT_WEBHOOK_SECRET=tu_secret_aqui
```
> Genera un secret seguro para proteger el webhook.

### 6b. Deploy del edge function
```bash
supabase functions deploy revenuecat-webhook
```

### 6c. Configurar webhook en RevenueCat
1. Dashboard → Project Settings → **Integrations** → Webhooks
2. URL: `https://hctwcziqereogduhlrjs.supabase.co/functions/v1/revenuecat-webhook`
3. Authorization header: `Bearer tu_secret_aqui` (mismo que paso 6a)

## 7. Aplicar migración de base de datos

```bash
supabase db push
```

O manualmente ejecutar:
```
backend/supabase/migrations/20260301000002_revenuecat_subscriptions.sql
```

## 8. Instalar dependencias Flutter

```bash
cd app
flutter pub get
```

## 9. Probar (Sandbox)

1. Configura una **License Testing account** en Google Play Console
2. Instala la app en un dispositivo físico (las suscripciones no funcionan en emulador)
3. La API key `test_*` ya habilita el modo sandbox de RevenueCat
4. Verifica en RevenueCat Dashboard → Customers que aparece tu usuario

---

## Checklist

- [ ] Cuenta RevenueCat creada
- [ ] App de Google Play agregada con service credentials
- [ ] Productos creados en Play Console (monthly + yearly)
- [ ] Entitlement `pro` creado y productos asociados
- [ ] Offering `default` con ambos packages
- [ ] API key configurada en la app
- [ ] Webhook secret en Supabase
- [ ] Edge function desplegada
- [ ] Webhook URL configurada en RevenueCat
- [ ] Migración de DB aplicada
- [ ] `flutter pub get` ejecutado
- [ ] Prueba en sandbox exitosa
