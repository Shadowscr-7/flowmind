# Flowmind 💰

**App de finanzas personales con IA** — Captura automática de ingresos/gastos vía texto, voz y foto de ticket.

## Stack Tecnológico

- **Mobile**: Flutter (Dart) — Android + iOS
- **Backend**: Supabase (Postgres + RLS + Storage + Edge Functions)
- **IA**: Whisper (STT) + Google Cloud Vision (OCR) + LLM (parsing/categorización)
- **Analytics**: Firebase Analytics + Crashlytics
- **Notificaciones**: Firebase Cloud Messaging

## Estructura del Proyecto

```
flowmind/
├── app/                    # Flutter app (Android + iOS)
│   ├── lib/
│   │   ├── core/           # Configuración, constantes, tema
│   │   ├── data/           # Modelos, repositorios, fuentes de datos
│   │   ├── domain/         # Entidades, casos de uso
│   │   ├── presentation/   # Pantallas, widgets, providers
│   │   └── services/       # Servicios IA, notificaciones
│   └── ...
├── backend/                # Supabase backend
│   ├── supabase/
│   │   ├── migrations/     # Migraciones SQL
│   │   └── functions/      # Edge Functions (Deno/TypeScript)
│   └── ...
└── docs/                   # Documentación
```

## Empezar

### Requisitos
- Flutter SDK >= 3.x
- Dart SDK >= 3.x
- Supabase CLI
- Node.js >= 18 (para Edge Functions)

### Configuración
1. Clonar el repo
2. Configurar Supabase: `cd backend && supabase start`
3. Configurar variables de entorno (ver `.env.example`)
4. Correr la app: `cd app && flutter run`

## Roadmap

- [x] MVP: Auth + Transactions + Quick Add (texto/voz/ticket)
- [ ] v1: Presupuestos, Insights, Forecast, Suscripciones
- [ ] v2: Web Admin, Integraciones bancarias

## Licencia

Privado © 2026 Flowmind
