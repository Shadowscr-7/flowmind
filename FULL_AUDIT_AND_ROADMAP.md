# Flowmind — Auditoría Completa, Roadmap de Valor y Análisis de Seguridad

> Generado: 5 de marzo de 2026  
> Versión app: 1.0.1+2 | Flutter 3.8+ | Supabase backend

---

## TABLA DE CONTENIDOS

1. [Hallazgos Bloqueantes para Google Play](#1-hallazgos-bloqueantes-para-google-play)
2. [Configuraciones Faltantes / Variables de Entorno](#2-configuraciones-faltantes--variables-de-entorno)
3. [Bugs y Problemas Técnicos Detectados](#3-bugs-y-problemas-técnicos-detectados)
4. [Análisis de Seguridad de Datos](#4-análisis-de-seguridad-de-datos)
5. [Features que Agregan Valor Real](#5-features-que-agregan-valor-real)
6. [Mejoras de Calidad y Deuda Técnica](#6-mejoras-de-calidad-y-deuda-técnica)
7. [Checklist Final Pre-Launch Google Play](#7-checklist-final-pre-launch-google-play)

---

## 1. HALLAZGOS BLOQUEANTES PARA GOOGLE PLAY

### 1.1 RevenueCat usa API Key de prueba

| Item | Detalle |
|---|---|
| **Archivo** | `app/lib/services/revenuecat_service.dart` → `RevenueCatConfig.apiKey` |
| **Problema** | El `defaultValue` es `test_X0BAzzQkdFixeGSvxbtzM0vvxHp`. Si no se pasa `REVENUECAT_API_KEY` por dart-define, usa la key de test. Las compras reales **no funcionarán** en producción. |
| **Solución** | 1) Obtener API key de producción de RevenueCat dashboard. 2) Agregar `REVENUECAT_API_KEY=goog_XXXX` al `.env`. 3) Eliminar el `defaultValue` de test para forzar que falle si no se configura. |
| **Impacto** | **CRÍTICO** — Sin esto, toda la monetización está rota. |

### 1.2 `android:label` sigue como `"flowmind_app"`

| Item | Detalle |
|---|---|
| **Archivo** | `app/android/app/src/main/AndroidManifest.xml` |
| **Problema** | `android:label="flowmind_app"` — así aparece en Google Play y en el launcher del usuario. Debería ser `"Flowmind"`. |
| **Solución** | Cambiar `android:label="Flowmind"` |
| **Impacto** | **ALTO** — Google puede rechazar la app o se ve poco profesional. |

### 1.3 No hay ProGuard / R8 configurado para release

| Item | Detalle |
|---|---|
| **Archivo** | `app/android/app/build.gradle.kts` → `buildTypes.release` |
| **Problema** | No tiene `isMinifyEnabled = true` ni `isShrinkResources = true`. La APK será más grande de lo necesario y el código Java/Kotlin no está ofuscado. |
| **Solución** | Agregar en el bloque `release`: `isMinifyEnabled = true`, `isShrinkResources = true`, `proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")`. Crear `proguard-rules.pro` con reglas para Flutter, Supabase y Firebase. |
| **Impacto** | **ALTO** — APK grande y código no ofuscado. Google Play puede advertirlo. |

### 1.4 deploy.cmd usa package name viejo

| Item | Detalle |
|---|---|
| **Archivo** | `deploy.cmd` |
| **Problema** | Usa `com.example.flowmind_app` en el `adb shell am start`. El package real es `com.flowmind.flowmind_app`. También tiene paths hardcodeados a `C:\Users\jgomez\...` |
| **Solución** | Corregir namespace en deploy.cmd. Usar paths relativos. |
| **Impacto** | **MEDIO** — Solo afecta el script de deploy, no la app en sí. |

### 1.5 Falta Política de Privacidad

| Item | Detalle |
|---|---|
| **Problema** | Google Play **requiere** URL de política de privacidad. No hay ninguna en el proyecto. La app recopila datos financieros, emails, biometría, grabaciones de voz, imágenes de recibos y tokens FCM. |
| **Solución** | Crear una política de privacidad completa (puede hostearse en GitHub Pages, Firebase Hosting o web estática). Debe cubrir: datos recopilados, uso de IA (OpenAI/Google Vision), almacenamiento, derechos del usuario, contacto. |
| **Impacto** | **BLOQUEANTE** — Google Play no acepta la app sin esto. |

### 1.6 Falta Data Safety Declaration

| Item | Detalle |
|---|---|
| **Problema** | Google Play Console requiere completar el formulario de "Data Safety". La app envía datos financieros a OpenAI (tercero), usa Firebase Analytics, Google Sign-In, FCM, y almacena datos en Supabase. Todo esto debe declararse. |
| **Solución** | Completar el formulario en Google Play Console declarando: datos financieros, email, nombre, voz, imágenes, device IDs, analytics. Indicar que OpenAI es procesador de datos. |
| **Impacto** | **BLOQUEANTE** — Google Play no acepta sin esto. |

### 1.7 Icono de la app es genérico

| Item | Detalle |
|---|---|
| **Archivo** | `@mipmap/ic_launcher` (por defecto es el icono de Flutter) |
| **Problema** | Si no se cambió el icono por defecto, Google Play lo rechazará o se verá poco profesional. |
| **Solución** | Crear icono con `flutter_launcher_icons` package. Necesitás: icono foreground (1024x1024), adaptive icon (background + foreground layers). |
| **Impacto** | **ALTO** — Imagen de marca. |

### 1.8 No hay App Bundle (AAB) — solo APK

| Item | Detalle |
|---|---|
| **Problema** | Google Play **requiere AAB** (Android App Bundle) desde 2021. El setup actual solo genera APK (`flutter build apk`). |
| **Solución** | Usar `flutter build appbundle --release --dart-define-from-file=.env` |
| **Impacto** | **BLOQUEANTE** — Google Play rechaza APK para nuevas apps. |

---

## 2. CONFIGURACIONES FALTANTES / VARIABLES DE ENTORNO

### 2.1 Variables de Entorno del Cliente Flutter (`.env`)

| Variable | Estado | Notas |
|---|---|---|
| `SUPABASE_URL` | Definida en `.env.example` | Debe configurarse con URL real del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Definida en `.env.example` | Debe configurarse con anon key real |
| `REVENUECAT_API_KEY` | **Falta en `.env.example`** | Debe agregarse al `.env.example` y al `.env` real |

**Acción:** Actualizar `app/env.example`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
REVENUECAT_API_KEY=your-revenuecat-public-api-key
```

### 2.2 Variables de Entorno del Backend Supabase (Edge Functions)

| Variable | Servicio | Estado |
|---|---|---|
| `SUPABASE_URL` | Auto-inyectada por Supabase | OK |
| `SUPABASE_ANON_KEY` | Auto-inyectada por Supabase | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-inyectada por Supabase | OK |
| `OPENAI_API_KEY` | OpenAI GPT-4o-mini + Whisper | **Debe configurarse con `supabase secrets set`** |
| `GOOGLE_CLOUD_API_KEY` | Google Cloud Vision OCR | **Debe configurarse con `supabase secrets set`** |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | FCM Push Notifications | **Debe configurarse con `supabase secrets set`** |
| `REVENUECAT_WEBHOOK_SECRET` | Webhook de RevenueCat | **Debe configurarse con `supabase secrets set`** |

**Comando para setear todos:**
```bash
supabase secrets set \
  OPENAI_API_KEY=sk-XXXX \
  GOOGLE_CLOUD_API_KEY=AIzaXXXX \
  FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
  REVENUECAT_WEBHOOK_SECRET=whsec_XXXX
```

### 2.3 Variables del Admin Panel

| Variable | Estado |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | En `.env.local.example` — OK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | En `.env.local.example` — OK |
| `SUPABASE_SERVICE_ROLE_KEY` | En `.env.local.example` — OK |

**Nota:** El admin usa service role key que bypasea RLS. Esto es necesario pero peligroso — asegurarse de que el admin **nunca** se exponga públicamente sin autenticación.

### 2.4 Build & Signing

| Config | Estado |
|---|---|
| `key.properties` | Template existe (`key.properties.example`). Debe crearse el real con el keystore. |
| Keystore JKS | Debe generarse si no existe: `keytool -genkey -v -keystore flowmind-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias flowmind` |
| `google-services.json` | Existe con project real `flowmind-a4cd6` — **OK** |

---

## 3. BUGS Y PROBLEMAS TÉCNICOS DETECTADOS

### 3.1 Doble inicialización de FlutterLocalNotificationsPlugin

| Detalle |
|---|
| `NotificationService.initialize()` y `PushNotificationService.initialize()` **ambos** llaman a `_plugin.initialize()`. El segundo sobreescribe el `onDidReceiveNotificationResponse` del primero. |
| **Riesgo:** Al tocar una notificación local (no push), el handler de `NotificationService` puede no ejecutarse. |
| **Solución:** El `PushNotificationService` ya usa `NotificationService().plugin` compartido, pero luego lo re-inicializa. Eliminar la segunda inicialización y usar el plugin ya inicializado. |

### 3.2 Google Sign-In `webClientId` hardcodeado

| Detalle |
|---|
| `auth_service.dart` tiene `926528581583-0rsvog8sml2caq6l2ifmhabburvh9dlj.apps.googleusercontent.com` hardcodeado. |
| **Riesgo:** Si cambia el proyecto de Firebase, se rompe. Debería venir de config o dart-define. |
| **Impacto:** MEDIO — funcional pero poco mantenible. |

### 3.3 `scheduleDailyReminder()` nunca se llama

| Detalle |
|---|
| La función existe en `NotificationService` pero no hay ninguna pantalla ni lógica que la invoque. |
| **Impacto:** Feature anunciada pero no funcional. |

### 3.4 Transacciones recurrentes (`isRecurring`) sin implementar

| Detalle |
|---|
| El campo `is_recurring` se envía al backend en `confirm-transaction`, pero no hay UI para configurarlas ni lógica de auto-repetición. |
| **Impacto:** Feature fantasma en el modelo de datos. |

### 3.5 Transferencias sin selector de cuenta destino

| Detalle |
|---|
| El tipo `transfer` existe en el modelo, se envía `transfer_to_account_id` al backend, pero no hay UI para seleccionar la cuenta destino. |
| **Impacto:** Feature incompleta. |

### 3.6 Export a PDF no implementado

| Detalle |
|---|
| `SubscriptionConfig.proFeatures` promete "Descarga tus datos en CSV o JSON" pero no hay implementación de export. |
| **Impacto:** Publicidad engañosa en el paywall. |

### 3.7 `ReceiptRepository` no existe

| Detalle |
|---|
| El modelo `receipt.dart` existe, la tabla `receipts` existe con RLS, pero no hay `ReceiptRepository` para CRUD. Las imágenes se procesan por IA pero no se guardan con referencia navegable. |

### 3.8 Cero tests reales

| Detalle |
|---|
| `test/widget_test.dart` solo tiene `expect(1+1, 2)`. No hay tests unitarios ni de integración. |
| **Impacto:** Cualquier refactor puede romper cosas sin detectarlo. |

---

## 4. ANÁLISIS DE SEGURIDAD DE DATOS

### 4.1 Resumen General

| Aspecto | Estado | Riesgo |
|---|---|---|
| **RLS (Row Level Security)** | Habilitado en todas las tablas | BUENO |
| **Autenticación** | Supabase Auth + Google Sign-In + JWT | BUENO |
| **Encriptación en tránsito** | HTTPS para Supabase, OpenAI, FCM | BUENO |
| **Encriptación en reposo** | Supabase (PostgreSQL) encripta por defecto | BUENO |
| **DB local (Drift/SQLite)** | **Sin encriptar** | RIESGO MEDIO |
| **SharedPreferences** | Datos de cola offline en texto plano | RIESGO BAJO |
| **Biometría (local_auth)** | Integrado pero uso no verificado | REVISAR |
| **OCR/IA terceros** | Imágenes y textos enviados a OpenAI/Google | DECLARAR |
| **FCM Tokens** | Almacenados en Supabase `profiles.fcm_token` | OK |
| **Keystore** | `.gitignore` excluye `key.properties` | BUENO |
| **Supabase keys** | Via `--dart-define-from-file` (no hardcodeadas) | BUENO |

### 4.2 Vulnerabilidades RLS Encontradas

#### CRÍTICA: Notifications INSERT — cualquier usuario puede crear para otro
```sql
-- Migración: 20260227000001_notifications_fcm.sql
CREATE POLICY "insert_notifications" ON notifications
  FOR INSERT WITH CHECK (true);  -- ← SIN VERIFICAR user_id
```
**Riesgo:** Un usuario autenticado puede insertar notificaciones falsas para cualquier otro usuario.

**Solución:**
```sql
DROP POLICY "insert_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Las edge functions usan service_role que bypasea RLS, así que siguen funcionando.
```

#### CRÍTICA: Subscriptions INSERT/UPDATE — policies demasiado permisivas
```sql
-- Migración: 20260301000002_revenuecat_subscriptions.sql
CREATE POLICY "service_insert" ON subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "service_update" ON subscriptions FOR UPDATE USING (true) WITH CHECK (true);
```
**Riesgo:** Cualquier usuario autenticado puede modificar la suscripción de cualquier otro usuario, dándose plan "pro" gratis.

**Solución:**
```sql
DROP POLICY "service_insert" ON subscriptions;
DROP POLICY "service_update" ON subscriptions;
-- No se necesitan policies extra. El webhook usa service_role que bypasea RLS.
-- Solo dejar las policies de "own user":
-- insert_own_subscription: auth.uid() = user_id (ya existe)
-- update_own_subscription: auth.uid() = user_id (ya existe)
```

#### MEDIO: Profiles no tiene policy de INSERT
- El `handle_new_user()` trigger con `SECURITY DEFINER` se encarga del INSERT al registrarse.
- Pero si algún cliente intenta insertar directamente → error silencioso.
- **No es un riesgo** pero podría causar confusión.

#### BAJO: analytics_events — solo INSERT, sin SELECT/UPDATE/DELETE
- Los usuarios no pueden leer sus propios analytics events.
- No es un problema de seguridad pero sí funcional si quisieras mostrar actividad.

### 4.3 Datos Enviados a Terceros

| Servicio | Datos Enviados | Propósito |
|---|---|---|
| **OpenAI GPT-4o-mini** | Texto de transacciones del usuario | Parsing de transacciones |
| **OpenAI Whisper** | Audio grabado por el usuario | Speech-to-text |
| **Google Cloud Vision** | Imagen de tickets/recibos | OCR |
| **Firebase Analytics** | User ID, screen views, eventos | Analytics |
| **Firebase Crashlytics** | User ID, stack traces, errores | Error tracking |
| **Firebase Cloud Messaging** | Device token | Push notifications |
| **RevenueCat** | User ID, purchase events | Subscriptions |

> **IMPORTANTE para Data Safety en Google Play**: Todo esto debe declararse. OpenAI y Google Vision procesan datos financieros personales.

### 4.4 DB Local Sin Encriptar (Drift/SQLite)

El SQLite local almacena:
- Transacciones financieras
- Cuentas bancarias con saldos
- Datos de perfil
- Insights de IA
- Cola de sincronización con payloads

**Si el dispositivo está rooteado o comprometido**, estos datos son legibles.

**Solución recomendada:** Usar `sqflite_sqlcipher` o `drift` con `encrypted_moor` para encriptar la DB local con el `flutter_secure_storage`.

### 4.5 SharedPreferences en Texto Plano

`OfflineQueueService` almacena toda la cola de AI en SharedPreferences como JSON plano. Puede contener textos financieros del usuario.

**Solución recomendada:** Migrar datos sensibles a `flutter_secure_storage` (usa KeyStore en Android).

---

## 5. FEATURES QUE AGREGAN VALOR REAL

### 5.1 Alta Prioridad — Diferenciadores de Mercado

#### A) Recordatorio Diario Inteligente
```
Estado: Código existe, nunca se llama
Esfuerzo: 2-4 horas
Valor: ALTO — Retención de usuarios
```
**Qué hacer:**
- Agregar toggle en Settings: "Recordatorio diario" con selector de hora
- Llamar `NotificationService().scheduleDailyReminder(hour, minute)` al guardar
- Mostrar progreso del día en la notificación ("Registraste 3 gastos hoy")
- Bonus: Personalizarlo con IA basado en patrones del usuario

#### B) Transacciones Recurrentes
```
Estado: Campo en modelo, sin UI ni lógica
Esfuerzo: 1-2 días
Valor: ALTO — Reduce fricción del usuario
```
**Qué hacer:**
- UI para marcar transacción como recurrente (período: diario/semanal/mensual)
- Edge function que corra con cron y cree transacciones automáticas
- Notificación cuando se ejecuta: "Se registró tu gasto recurrente Netflix $14.99"
- Ejemplos: alquiler, sueldo, suscripciones, servicios

#### C) Transfer entre Cuentas
```
Estado: Tipo existe, sin UI de selección
Esfuerzo: 4-8 horas
Valor: MEDIO-ALTO — Crucial para multi-cuenta
```
**Qué hacer:**
- Agregar selector de cuenta destino en `AddTransactionScreen` cuando tipo = "transfer"
- El balance trigger ya maneja `transfer_to_account_id`

#### D) Export de Datos (CSV/PDF)
```
Estado: Prometido en paywall, no implementado
Esfuerzo: 1-2 días
Valor: ALTO — Feature pro real
```
**Qué hacer:**
- CSV: fácil con `dart:convert` → `share_plus` (ya está como dependencia)
- PDF: usar `pdf` package para generar reportes mensuales estéticos
- Agregar botón en historial de transacciones y en insights

#### E) Cuota de IA Visible al Usuario
```
Estado: Backend la controla, pero el user nunca la ve
Esfuerzo: 2-4 horas
Valor: MEDIO — Transparencia y upsell
```
**Qué hacer:**
- Agregar `ai_usage_count / quota` visible en home o settings
- Cuando quede <10 consultas, mostrar banner suave "Te quedan X consultas de IA"
- Cuando se agote, mostrar paywall en vez de error genérico 429

### 5.2 Media Prioridad — Engagement y Retención

#### F) Widget de Home Screen (Android)
```
Esfuerzo: 1-2 días
Valor: ALTO — Engagement pasivo
```
- Widget con saldo total y resumen del día
- Botón rápido para agregar gasto
- Usa `home_widget` package

#### G) Resumen Semanal/Mensual Push
```
Esfuerzo: 4-8 horas
Valor: ALTO — Retención
```
- Edge function con cron semanal
- "Esta semana gastaste $X. Tu categoría top fue Supermercado ($Y)."
- Para Pro: incluir insight de IA

#### H) Modo Oscuro Personalizable
```
Estado: Ya soporta system theme
Esfuerzo: 2-4 horas
Valor: MEDIO — UX
```
- Agregar selector manual: Claro / Oscuro / Sistema
- Guardar preferencia en SharedPreferences / perfil

#### I) Categorías Custom con Iconos
```
Estado: Categorías custom existen (free tier)
Esfuerzo: 4-8 horas
Valor: MEDIO — Personalización
```
- Permitir elegir emoji/icono para cada categoría
- Color personalizable por categoría
- Se reflejará en gráficos

#### J) Goals / Metas de Ahorro
```
Esfuerzo: 2-3 días
Valor: ALTO — Engagement a largo plazo
```
- Definir meta: "Ahorrar $X para Y en Z meses"
- Tracking visual (progress bar)
- Notificaciones de progreso
- Insight de IA sobre viabilidad

### 5.3 Baja Prioridad — Nice to Have

#### K) Multi-idioma (i18n)
```
Esfuerzo: 2-3 días
Valor: MEDIO — Expansión de mercado
```
- Usa `intl` (ya es dependencia) + ARB files
- Español (base) + Inglés + Portugués

#### L) Compartir Insight como Imagen
```
Esfuerzo: 4-8 horas
Valor: BAJO-MEDIO — Viralidad
```
- `share_plus` + `RepaintBoundary.toImage()`
- Genera imagen con branding para compartir en redes

#### M) Backup & Restore Manual
```
Esfuerzo: 1 día
Valor: MEDIO — Confianza del usuario
```
- Exportar DB local como JSON encriptado
- Importar desde backup
- Almacenar en Supabase Storage

---

## 6. MEJORAS DE CALIDAD Y DEUDA TÉCNICA

### 6.1 Testing

| Área | Qué hacer | Prioridad |
|---|---|---|
| Unit tests | Services: `AuthService`, `SyncService`, `AiService`, `OfflineWriteService` | ALTA |
| Widget tests | Pantallas clave: Login, Home, AddTransaction, ConfirmTransaction | ALTA |
| Integration tests | Flujo completo: signup → agregar cuenta → crear transacción → sync | MEDIA |
| E2E con Patrol/Maestro | Happy paths de usuario | BAJA |

### 6.2 Code Quality

| Item | Problema | Solución |
|---|---|---|
| `AppNotification` | No usa Freezed como los demás modelos | Migrar a Freezed + json_serializable |
| `ProfileSettings` | Nunca se usa en ningún sitio | Eliminar código muerto |
| `deploy.cmd` | Paths hardcodeados, namespace viejo | Rehacer con paths relativos |
| Error handling | Muchos `catch (e) { debugPrint(...) }` que swallowean errores | Logging estructurado con Crashlytics |
| Null safety | Varios `!` forzados en auth service | Manejar nulls gracefully |

### 6.3 Performance

| Item | Recomendación |
|---|---|
| Imágenes de recibos | Comprimir antes de enviar a backend (actualmente envío full-res) |
| Pull de transactions | Limita a 200 en sync, pero no hay paginación en UI |
| Drift queries | Sin índices explícitos en la DB local |
| Google Fonts | Descarga fonts en runtime → aumenta TTFF. Pre-bundle fuentes. |

### 6.4 Observabilidad

| Item | Recomendación |
|---|---|
| Backend logs | Las edge functions usan `console.log/error`. Agregar structured logging. |
| Alertas de error | No hay alertas cuando fallan las edge functions. Configurar alerting en Supabase o Firebase. |
| Analytics de negocio | No se trackea: tasa de conversión free→pro, retención diaria/semanal, AI usage trends |

---

## 7. CHECKLIST FINAL PRE-LAUNCH GOOGLE PLAY

### Infraestructura (una sola vez)
- [ ] Crear cuenta de Google Play Developer ($25 USD)
- [ ] Crear cuenta de RevenueCat y obtener API key de producción
- [ ] Configurar productos de suscripción en Google Play Console
- [ ] Configurar Google Cloud API key para Vision (con restricciones de API)
- [ ] Configurar OpenAI API key (con billing y limits)
- [ ] Generar Firebase service account JSON para FCM

### Configuración del Proyecto
- [ ] Crear `.env` real basado en `env.example` con TODAS las variables
- [ ] Crear `key.properties` basado en `key.properties.example`
- [ ] Generar keystore si no existe (`keytool -genkey ...`)
- [ ] Ejecutar `supabase secrets set` con todas las env vars del backend
- [ ] Desplegar edge functions: `supabase functions deploy`
- [ ] Aplicar migraciones: `supabase db push`
- [ ] Configurar webhook de RevenueCat apuntando a la edge function

### Correcciones Bloqueantes
- [ ] Cambiar `android:label` a `"Flowmind"` en AndroidManifest.xml
- [ ] Crear icono personalizado (no el de Flutter por defecto)
- [ ] Agregar ProGuard/R8 al build release
- [ ] Corregir RLS de `notifications` (INSERT `WITH CHECK (auth.uid() = user_id)`)
- [ ] Corregir RLS de `subscriptions` (eliminar policies de `true`)
- [ ] Eliminar `defaultValue` de RevenueCat test key
- [ ] Agregar `REVENUECAT_API_KEY` al `env.example`

### Build & Publicación
- [ ] Build AAB: `flutter build appbundle --release --dart-define-from-file=.env`
- [ ] Testear AAB en dispositivo real: `bundletool build-apks --bundle=app.aab`
- [ ] Crear ficha en Google Play Console:
  - [ ] Título, descripción corta y larga (en español)
  - [ ] Screenshots (mínimo 2 para teléfono)
  - [ ] Feature graphic (1024x500)
  - [ ] Icono de la app (512x512)
- [ ] Completar Data Safety Declaration
- [ ] Crear y publicar Política de Privacidad (URL)
- [ ] Crear y publicar Términos de Servicio (URL, recomendado)
- [ ] Clasificación de contenido (IARC)
- [ ] Target audience (adultos — datos financieros)
- [ ] Subir AAB a Google Play Console
- [ ] Configurar testing tracks (Internal → Closed → Open → Production)
- [ ] Probar compras in-app en sandbox

### Post-Launch
- [ ] Monitorear Crashlytics por crashes
- [ ] Monitorear RevenueCat por conversiones
- [ ] Configurar alertas en Firebase para anomalías
- [ ] Responder reviews en Google Play
- [ ] Iterar basado en feedback real

---

## DIAGRAMA DE FLUJO — ESTADO ACTUAL vs. OBJETIVO

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLOWMIND — FLUJO DE DATOS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USUARIO                                                         │
│    │                                                             │
│    ├──→ Texto libre  ──→ Edge Function (ingest-text)             │
│    │                      └──→ OpenAI GPT-4o-mini                │
│    │                           └──→ Draft JSON ──→ Confirmar     │
│    │                                                             │
│    ├──→ Voz          ──→ Edge Function (ingest-voice)            │
│    │                      ├──→ OpenAI Whisper (STT)              │
│    │                      └──→ OpenAI GPT-4o-mini (parse)        │
│    │                           └──→ Draft JSON ──→ Confirmar     │
│    │                                                             │
│    ├──→ Foto ticket  ──→ Edge Function (ingest-receipt)          │
│    │                      ├──→ Google Vision (OCR)               │
│    │                      └──→ OpenAI GPT-4o-mini (parse)        │
│    │                           └──→ Draft JSON ──→ Confirmar     │
│    │                                                             │
│    └──→ Confirmar ──→ Edge Function (confirm-transaction)        │
│                        └──→ Supabase DB                          │
│                             ├──→ transactions (INSERT)           │
│                             └──→ accounts.current_balance        │
│                                  (trigger automático)            │
│                                                                  │
│  SYNC OFFLINE                                                    │
│    Drift (SQLite) ←──→ SyncService ←──→ Supabase                │
│    OfflineQueue   ←──→ Connectivity listener                     │
│                                                                  │
│  ALERTAS AUTOMÁTICAS                                             │
│    Supabase Cron (cada 6h)                                       │
│    └──→ alerts-run                                               │
│         ├──→ Evalúa budgets, saldos, pronósticos                 │
│         └──→ FCM push → usuario                                  │
│                                                                  │
│  MONETIZACIÓN                                                    │
│    RevenueCat ←──→ Google Play Billing                           │
│    └──→ Webhook ──→ revenuecat-webhook                           │
│         └──→ Supabase profiles.plan + subscriptions              │
│                                                                  │
│  ⚠️  GAPS ACTUALES                                               │
│    ✗ Transacciones recurrentes (campo existe, sin lógica)        │
│    ✗ Transferencias (sin UI de cuenta destino)                   │
│    ✗ Export CSV/PDF (prometido, no implementado)                 │
│    ✗ Daily reminder (código existe, nunca se llama)              │
│    ✗ ReceiptRepository (sin historial navegable)                 │
│    ✗ AI quota visible al usuario                                 │
│    ✗ DB local sin encriptar                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## RESUMEN EJECUTIVO

### Lo que está BIEN hecho
- Arquitectura limpia con Riverpod + Freezed + Drift
- Sync offline-first funcional (queue + retry + pull)
- IA multi-modal (texto, voz, imagen) con prompts bien diseñados
- RLS en todas las tablas (con excepciones a corregir)
- Credenciales no hardcodeadas (env vars via dart-define)
- Firebase Analytics + Crashlytics integrado
- RevenueCat integrado con webhook server-side
- Alertas financieras inteligentes con cron
- Admin panel separado con Next.js

### Lo que BLOQUEA el lanzamiento
1. Política de Privacidad (falta)
2. Data Safety Declaration (falta)
3. AAB en vez de APK
4. RevenueCat test key → producción
5. `android:label` y ícono
6. Vulnerabilidades RLS en notifications y subscriptions

### Lo que MÁS valor agrega rápido
1. **Daily reminder** — 2h de trabajo, retención inmediata
2. **Transfer entre cuentas** — 4h, feature esperada
3. **Export CSV** — 4h, justifica el plan Pro
4. **Cuota IA visible** — 2h, transparencia + upsell
5. **Widget de home** — 1-2 días, engagement pasivo

### Estado de seguridad: 7/10
- Puntos fuertes: RLS, HTTPS, no hardcoded secrets, auth sólido
- Puntos débiles: 2 policies RLS vulnerables, DB local sin encriptar, datos a terceros sin DPA formal
