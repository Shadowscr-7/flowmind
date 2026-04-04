# FlowMind — Auditoría del Proyecto

## CRÍTICO — Seguridad & Configuración

1. **`google-services.json` es placeholder** — tiene `"project_id": "flowmind-placeholder"` y keys falsas. Firebase no funciona (Analytics, Crashlytics, FCM, Google Sign-In, todo roto).
2. **No hay `GoogleService-Info.plist`** para iOS — Firebase no funciona en iOS en absoluto.
3. **RevenueCat tiene test key** — `revenuecat_service.dart` usa `test_X0BAzzQkdFixeGSvxbtzM0vvxHp`. Las compras en producción no funcionarán.
4. **Credenciales de Supabase hardcodeadas** en `app_config.dart` con `defaultValue` real.
5. **No hay signing config para release** en `android/app/build.gradle.kts` — no se puede publicar en Play Store.

---

## ALTO — Features implementadas pero desconectadas

6. **`AnalyticsService` nunca se inicializa** — `initialize()`, `setUserId()`, `logScreenView()` nunca se llaman. Todo el pipeline de analytics existe pero está desconectado del UI.
7. **`OfflineQueueService` nunca se usa** — está completamente implementado (queue de texto, voz, recibos) pero ninguna pantalla lo usa. Las features de AI fallan silenciosamente sin internet.
8. **No existe `AlertRepository` ni UI de alertas** — el modelo `Alert` existe, la tabla en BD existe, la edge function `alerts-run` existe, pero no hay repositorio, provider, ni pantalla para gestionar alertas.
9. **La generación de Insights nunca se dispara** — `insightsProvider` lee de Supabase pero nada llama a `AiService.getInsightsSummary()` para generarlos. La pantalla de insights queda vacía.
10. **Sync offline no funciona realmente** — ningún repositorio encola operaciones cuando hay desconexión. Crear/editar/borrar transacciones offline falla silenciosamente.
11. **Budgets devuelven lista vacía offline** — el provider lo dice explícitamente con un comentario TODO.

---

## MEDIO — Features faltantes o incompletas

12. **No hay `ReceiptRepository`** — el modelo `Receipt` existe pero no se puede listar ni ver el historial de recibos.
13. **Transacciones recurrentes no implementadas** — el campo `isRecurring` existe en el modelo pero no hay UI ni lógica backend para crearlas o auto-generarlas.
14. **Transferencias entre cuentas sin UI** — `TransactionType.transfer` existe pero no hay selector de cuenta destino en `AddTransactionScreen`.
15. **Exportar a PDF no implementado** — se anuncia "CSV o PDF" en la config de suscripción pero solo funciona CSV.
16. **Daily reminder no conectado al UI** — `scheduleDailyReminder()` existe pero no se llama desde Settings.
17. **No se muestra cuota de AI al usuario** — se trackea `ai_usage_count` en backend pero el usuario no ve cuántas consultas le quedan antes de recibir un error 429.
18. **Cron de `alerts-run` no configurado** — la edge function existe pero no hay schedule en `config.toml`.
19. **iOS completamente sin configurar** — no hay entitlements para push, no hay config de RevenueCat iOS, no hay productos de suscripción.

---

## BAJO — Calidad de código y tests

20. **Cero tests** — `widget_test.dart` solo tiene `expect(1 + 1, 2)`.
21. **`AppNotification` no usa Freezed** — todos los modelos usan Freezed menos este.
22. **`ProfileSettings` nunca se usa** — la clase existe pero se ignora; settings se guardan como `Map<String, dynamic>` raw.
23. **Inicialización doble de notificaciones locales** — `PushNotificationService` y `NotificationService` ambos inicializan `FlutterLocalNotificationsPlugin` con canales distintos.
    
---

## Resumen

| Categoría | Cantidad | Severidad |
|---|---|---|
| Seguridad & Config | 5 | Crítico |
| Features desconectadas | 6 | Alto |
| Features incompletas | 8 | Medio |
| Calidad & Tests | 4 | Bajo |
| **Total** | **23** | — |

---

## Estado de correcciones (actualizado)

| # | Descripción | Estado |
|---|---|---|
| 4 | Supabase creds → `--dart-define-from-file=.env` | ✅ Corregido |
| 5 | Signing config para release (key.properties) | ✅ Corregido |
| 6 | AnalyticsService — init + userId + screen tracking | ✅ Corregido |
| 7 | OfflineQueueService — integrado en las 3 pestañas AI | ✅ Corregido |
| 8 | AlertRepository + provider + pantalla + ruta | ✅ Corregido |
| 9 | Insights — botón "Generar Insights IA" + pull-to-refresh | ✅ Corregido |
| 10 | Offline writes — OfflineWriteService para cuentas/budgets/categorías | ✅ Corregido |
| 11 | Budgets offline — computa spent desde caché local | ✅ Corregido |

---

## Servicios de IA utilizados

### 1. OpenAI GPT-4o-mini (LLM de texto)

- **Uso:** Parsear texto libre → transacciones, parsear tickets OCR → transacciones, generar resúmenes de insights
- **Edge Functions:** `ingest-text`, `ingest-receipt`, `insights-summary`
- **Configuración:** Temperatura 0.1, max_tokens 500, formato JSON
- **Variable de entorno:** `OPENAI_API_KEY`

### 2. OpenAI Whisper-1 (Speech-to-Text)

- **Uso:** Transcribir audio de voz → texto, que luego se parsea con GPT-4o-mini
- **Edge Function:** `ingest-voice`
- **Configuración:** Idioma forzado a `es` (español)
- **Variable de entorno:** `OPENAI_API_KEY` (misma key)

### 3. Google Cloud Vision API (OCR)

- **Uso:** Extraer texto de fotos de recibos/tickets
- **Edge Function:** `ingest-receipt`
- **Método:** `TEXT_DETECTION` (OCR general)
- **Variable de entorno:** `GOOGLE_CLOUD_API_KEY`

### 4. Firebase Cloud Messaging (Push Notifications)

- **Uso:** Enviar push de alertas financieras (saldo bajo, presupuesto excedido, etc.)
- **Edge Function:** `alerts-run` → `_shared/push.ts`
- **Método:** FCM HTTP v1 API con service account JWT
- **Variable de entorno:** `FIREBASE_SERVICE_ACCOUNT_JSON`

---

## Guía de configuración de servicios de IA

### Paso 1: OpenAI API Key

1. Ve a [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Crea una nueva API Key
3. En el dashboard de Supabase → **Project Settings** → **Edge Functions** → **Secrets**
4. Agrega: `OPENAI_API_KEY` = `sk-...`

> ⚠️ Modelos usados: `gpt-4o-mini` (text) + `whisper-1` (audio). Costo aprox: ~$0.15/1M tokens input, ~$0.60/1M output.

### Paso 2: Google Cloud Vision API

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto (o usa el de Firebase `flowmind-a4cd6`)
3. Habilita **Cloud Vision API** en **APIs & Services** → **Library**
4. Crea una API Key en **Credentials** → **Create Credentials** → **API Key**
5. Restringe la key solo a "Cloud Vision API"
6. En Supabase Secrets: `GOOGLE_CLOUD_API_KEY` = `AIza...`

### Paso 3: Firebase Service Account (para push)

1. Ve a [Firebase Console](https://console.firebase.google.com) → `flowmind-a4cd6`
2. **Project Settings** → **Service Accounts** → **Generate new private key**
3. Se descarga un JSON. El contenido ENTERO (sin saltos de línea) va como secret
4. En Supabase Secrets: `FIREBASE_SERVICE_ACCOUNT_JSON` = `{"type":"service_account","project_id":"flowmind-a4cd6",...}`

### Paso 4: Cron para alerts-run

Actualmente `alerts-run` no tiene schedule. Agrega esto al final de `backend/supabase/config.toml`:

```toml
[functions.alerts-run]
schedule = "0 */6 * * *"  # Cada 6 horas
```

### Paso 5: RevenuCat Webhook Secret

Si usas webhook de RevenueCat para sincronizar suscripciones:
1. En RevenueCat Dashboard → **Webhooks** → copia el secret
2. En Supabase Secrets: `REVENUECAT_WEBHOOK_SECRET` = `whsec_...`

### Resumen de variables de entorno requeridas

| Variable | Servicio | ¿Dónde se configura? |
|---|---|---|
| `SUPABASE_URL` | Supabase | Auto-configurado |
| `SUPABASE_ANON_KEY` | Supabase | Auto-configurado |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Auto-configurado |
| `OPENAI_API_KEY` | OpenAI GPT-4o-mini + Whisper | Supabase Secrets |
| `GOOGLE_CLOUD_API_KEY` | Google Cloud Vision OCR | Supabase Secrets |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | FCM Push | Supabase Secrets |
| `REVENUECAT_WEBHOOK_SECRET` | RevenueCat | Supabase Secrets |
