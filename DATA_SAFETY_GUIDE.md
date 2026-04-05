# Flowmind — Guía Data Safety Declaration (Google Play)

> Usa esta guía para completar el formulario de "Data Safety" en Google Play Console.
> Ruta: Google Play Console → Tu App → **Policy** → **App content** → **Data safety**

---

## Paso 1: Preguntas iniciales

| Pregunta | Respuesta |
|----------|-----------|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Do you provide a way for users to request that their data is deleted? | **Yes** (via email: jcg.software.solution@gmail.com) |

---

## Paso 2: Tipos de datos — Qué declarar

### Personal info

| Data type | Collected | Shared | Purpose | Optional |
|-----------|:---------:|:------:|---------|:--------:|
| **Name** | ✅ | ❌ | App functionality | No |
| **Email address** | ✅ | ❌ | App functionality, Account management | No |
| **User IDs** | ✅ | ✅ (RevenueCat, Firebase) | App functionality, Analytics | No |

### Financial info

| Data type | Collected | Shared | Purpose | Optional |
|-----------|:---------:|:------:|---------|:--------:|
| **User payment info** | ❌ | ❌ | — (Google Play maneja pagos) | — |
| **Purchase history** | ✅ | ✅ (RevenueCat) | App functionality (suscripciones) | No |
| **Other financial info** | ✅ | ✅ (OpenAI — procesamiento) | App functionality (transacciones, cuentas, presupuestos) | No |

### Photos and videos

| Data type | Collected | Shared | Purpose | Optional |
|-----------|:---------:|:------:|---------|:--------:|
| **Photos** | ✅ | ✅ (Google Cloud Vision) | App functionality (OCR de recibos) | Yes |

### Audio

| Data type | Collected | Shared | Purpose | Optional |
|-----------|:---------:|:------:|---------|:--------:|
| **Voice or sound recordings** | ✅ | ✅ (OpenAI Whisper) | App functionality (transcripción de voz) | Yes |
| **Other audio files** | ❌ | ❌ | — | — |

### App activity

| Data type | Collected | Shared | Purpose | Optional |
|-----------|:---------:|:------:|---------|:--------:|
| **App interactions** | ✅ | ✅ (Firebase Analytics) | Analytics | No |
| **In-app search history** | ❌ | ❌ | — | — |
| **Other user-generated content** | ✅ | ✅ (OpenAI) | App functionality (texto libre para transacciones) | No |

### App info and performance

| Data type | Collected | Shared | Purpose | Optional |
|-----------|:---------:|:------:|---------|:--------:|
| **Crash logs** | ✅ | ✅ (Firebase Crashlytics) | App functionality (diagnóstico) | No |
| **Diagnostics** | ✅ | ✅ (Firebase Crashlytics) | App functionality | No |

### Device or other IDs

| Data type | Collected | Shared | Purpose | Optional |
|-----------|:---------:|:------:|---------|:--------:|
| **Device or other IDs** | ✅ | ✅ (Firebase, FCM) | App functionality (push notifications), Analytics | No |

---

## Paso 3: Datos NO recopilados (marcar como "Not collected")

- ❌ Location (precise & approximate)
- ❌ Contacts
- ❌ Calendar
- ❌ SMS / Call logs
- ❌ Health & Fitness
- ❌ Files and docs
- ❌ Web browsing history
- ❌ Installed apps

---

## Paso 4: Para cada tipo de dato collected/shared, responder:

### ¿Es procesado de forma efímera?

| Dato | Efímero |
|------|:-------:|
| Audio (voz) | **Sí** — se envía a OpenAI, se transcribe y se descarta |
| Fotos (recibos) | **Sí** — se envía a Google Vision, se extrae texto y se descarta |
| Texto libre | **Sí** — se envía a OpenAI, se parsea y se descarta |
| Transacciones financieras | **No** — se almacenan permanentemente |
| Analytics events | **No** — se almacenan en Firebase |
| Crash logs | **No** — se almacenan en Crashlytics |

### ¿Es requerido o el usuario puede optar no darlo?

| Dato | Requerido |
|------|:---------:|
| Email / nombre | **Requerido** (para autenticación) |
| Transacciones financieras | **Requerido** (funcionalidad principal) |
| Voz, fotos | **Opcional** (el usuario elige usarlo o no) |
| Analytics / Crash logs | **Requerido** (no se puede desactivar) |

---

## Paso 5: Detalles adicionales

### Data sharing clarifications

Para **OpenAI** y **Google Cloud Vision**, marcar:
- Shared with: **Service provider** (procesador de datos, no tercero independiente)
- Purpose: **App functionality**
- NOT for: Advertising, Marketing, or Personalization by the third party

### Data retention and deletion

- User data is retained while the account is active
- Users can request deletion via email
- Data is deleted within 30 days of a deletion request
- Anonymous analytics data may be retained

---

## Paso 6: Preview y publicar

1. Revisa el **preview** que genera Google Play Console
2. Verifica que coincide con lo declarado en la Política de Privacidad
3. Guarda y publica

---

## Resumen visual (lo que verán los usuarios)

```
┌─────────────────────────────────────────┐
│         Data safety                      │
├─────────────────────────────────────────┤
│ Data shared with third parties:          │
│   • Financial info                       │
│   • Photos                               │
│   • Audio                                │
│   • App activity                         │
│   • App info and performance             │
│   • Device IDs                           │
├─────────────────────────────────────────┤
│ Data collected:                          │
│   • Personal info (name, email)          │
│   • Financial info                       │
│   • Photos                               │
│   • Audio                                │
│   • App activity                         │
│   • App info and performance             │
│   • Device IDs                           │
├─────────────────────────────────────────┤
│ ✔ Data encrypted in transit              │
│ ✔ You can request data deletion          │
└─────────────────────────────────────────┘
```

---

## Links necesarios en Google Play Console

| Campo | Valor |
|-------|-------|
| **Privacy Policy URL** | `https://tu-dominio.com/privacy-policy.html` |
| **Developer email** | `jcg.software.solution@gmail.com` |
| **Developer name** | Jcg Software Solutions |

> ⚠️ **IMPORTANTE:** La URL de la política de privacidad debe ser pública y accesible.
> Opciones para hostear `privacy-policy.html`:
> 1. **GitHub Pages** — gratis, push a un repo público
> 2. **Firebase Hosting** — `firebase deploy --only hosting`
> 3. **Vercel/Netlify** — drag & drop del HTML
> 4. **Supabase Storage** — bucket público
