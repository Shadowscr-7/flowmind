# Flowmind — Guía de instalación y ejecución

## Requisitos previos

| Herramienta | Versión mínima | Descarga |
|---|---|---|
| **Flutter SDK** | 3.41.2 (Dart 3.11) | https://docs.flutter.dev/get-started/install |
| **Android Studio** | 2024+ | https://developer.android.com/studio |
| **Node.js** | 18+ | https://nodejs.org |
| **Git** | 2.x | https://git-scm.com |

> **Nota:** Asegurate de tener el SDK de Android (API 35 recomendado) instalado desde Android Studio > SDK Manager.

---

## 1. Clonar / copiar el proyecto

```bash
# Si bajás el zip, descomprimilo y abrí una terminal en la carpeta:
cd flowmind
```

---

## 2. App Flutter (Android)

### 2.1 Verificar Flutter

```bash
flutter doctor
```

Asegurate de que Flutter y Android toolchain aparezcan con ✓.

### 2.2 Instalar dependencias

```bash
cd app
flutter pub get
```

### 2.3 Generar código (Freezed + Drift)

```bash
dart run build_runner build --delete-conflicting-outputs
```

Esto genera los archivos `.freezed.dart`, `.g.dart` necesarios para los modelos y la base de datos local.

### 2.4 Crear emulador (si no tenés uno)

```bash
# Listar dispositivos disponibles
flutter emulators

# Crear uno nuevo (opcional)
flutter emulators --create --name Medium_Phone_API_35

# Lanzar el emulador
flutter emulators --launch Medium_Phone_API_35
```

O directamente desde Android Studio > Device Manager.

### 2.5 Ejecutar la app

```bash
# Verificar que el emulador esté corriendo
flutter devices

# Ejecutar
flutter run -d emulator-5554
```

> **Modo Demo:** La app se conecta a Supabase. Si no configurás las credenciales reales, arranca automáticamente en **modo demo** con datos de ejemplo.

### 2.6 Análisis de código (opcional)

```bash
flutter analyze
```

### 2.7 Build release APK

```bash
flutter build apk --release
```

El APK queda en `app/build/app/outputs/flutter-apk/app-release.apk`.

---

## 3. Admin Panel (Next.js)

### 3.1 Instalar dependencias

```bash
cd admin
npm install
```

### 3.2 Configurar variables de entorno

```bash
# Copiar el ejemplo y editar con tus credenciales de Supabase
cp .env.local.example .env.local
```

Editar `.env.local` con:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### 3.3 Ejecutar en modo desarrollo

```bash
npm run dev
```

El panel admin queda en **http://localhost:3001**.

### 3.4 Build producción (opcional)

```bash
npm run build
npm run start
```

---

## 4. Configuración Supabase (opcional para desarrollo)

Si querés conectar a un backend real:

1. Crear proyecto en https://supabase.com
2. En la app Flutter, editar `app/lib/core/config/app_config.dart`:
   ```dart
   static const String supabaseUrl = 'https://TU-PROYECTO.supabase.co';
   static const String supabaseAnonKey = 'TU-ANON-KEY';
   ```
3. En el admin panel, editar `admin/.env.local` con las mismas credenciales.

---

## 5. Estructura del proyecto

```
flowmind/
├── app/                    # App Flutter (Android/iOS)
│   ├── lib/
│   │   ├── core/           # Config, theme, router, utils
│   │   ├── data/           # Modelos, repositorios, DB local (Drift)
│   │   ├── presentation/   # Screens, widgets, providers (Riverpod)
│   │   ├── services/       # AI, auth, sync, notificaciones
│   │   └── main.dart
│   ├── android/
│   ├── ios/
│   └── pubspec.yaml
├── admin/                  # Panel admin (Next.js + React + Tailwind)
│   ├── src/
│   │   ├── app/            # Pages (dashboard, users, transactions, etc.)
│   │   └── components/     # Sidebar, charts, tables
│   └── package.json
└── backend/                # Backend config (Supabase)
```

---

## 6. Tecnologías principales

| Componente | Tecnología |
|---|---|
| App móvil | Flutter 3.41.2, Dart 3.11, Riverpod, Freezed |
| DB local offline | Drift (SQLite) |
| Backend | Supabase (Auth + PostgreSQL + Storage) |
| Admin panel | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Gráficos | fl_chart (app), Recharts (admin) |
| Sync | connectivity_plus + SyncService personalizado |

---

## Resumen rápido de comandos

```bash
# --- App Flutter ---
cd app
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run -d emulator-5554

# --- Admin Panel ---
cd admin
npm install
npm run dev
```


Aquí tienes el resumen completo del estado actual de FlowMind y lo que falta para estar 100% operativa y lista para comercializar:

Estado actual: 9 de 23 issues resueltos, 14 pendientes
CORREGIDOS (9)
#	Item
1	google-services.json ahora tiene project real (flowmind-a4cd6)
4	Credenciales Supabase ya usan --dart-define-from-file
5	Signing config para release APK
6	AnalyticsService conectado (init + userId + screen tracking)
7	OfflineQueueService integrado en pestañas AI
8	AlertRepository + provider + pantalla + ruta
9	Insights con botón de generación IA
10	Offline writes para cuentas/budgets/categorías
11	Budgets offline con caché local
PENDIENTE PARA APP OPERATIVA Y COMERCIALIZABLE
BLOQUEANTES para lanzamiento (Crítico/Alto)
#	Qué falta	Por qué bloquea
3	RevenueCat usa test key (test_X0BAzzQkdFixeGSvxbtzM0vvxHp)	Las compras reales no funcionarán. Necesitas crear la app en RevenueCat con la key de producción de Google Play y configurar los productos flowmind_pro_monthly / flowmind_pro_yearly en Play Console
18	Cron de alerts-run no configurado en config.toml	Las alertas financieras (saldo bajo, presupuesto excedido) nunca se ejecutan automáticamente
2	No hay GoogleService-Info.plist para iOS	Firebase no funciona en iOS (sin analytics, push, ni crash reporting). Bloquea lanzamiento en App Store
19	iOS completamente sin configurar	Sin entitlements de push, sin config RevenueCat iOS, sin productos de suscripción iOS. Bloquea App Store
Necesarios para producto completo (Medio)
#	Qué falta	Impacto
12	No hay ReceiptRepository	El usuario no puede ver historial de recibos/tickets escaneados
13	Transacciones recurrentes sin implementar	El campo isRecurring existe en el modelo pero no hay UI ni lógica para crear, listar o auto-generar transacciones periódicas
14	Transferencias entre cuentas sin selector de cuenta destino	TransactionType.transfer existe pero la UI no permite elegir a qué cuenta va el dinero
15	Exportar a PDF no implementado	Se anuncia "CSV o PDF" en la suscripción Pro pero solo funciona CSV — es publicidad engañosa
16	Daily reminder desconectado	scheduleDailyReminder() existe pero nunca se llama desde Settings
17	Cuota de IA no visible al usuario	Se trackea ai_usage_count en backend pero el usuario recibe un error 429 sin saber cuántas consultas le quedan
Calidad y deuda técnica (Bajo, pero recomendado antes de producción)
#	Qué falta	Impacto
20	Cero tests reales	Solo expect(1+1, 2). Riesgo alto de regresiones
21	AppNotification no usa Freezed	Inconsistencia con el resto de modelos, mayor riesgo de bugs
22	ProfileSettings nunca se usa	Código muerto; settings se guardan como Map raw
23	Doble inicialización de notificaciones locales	PushNotificationService y NotificationService crean cada uno su FlutterLocalNotificationsPlugin. Puede causar conflictos
Plan de acción recomendado por prioridad
Fase 1 — Mínimo para lanzar en Google Play (Android)

Obtener API key de producción de RevenueCat y crear productos en Play Console (#3)
Agregar cron alerts-run al config.toml (#18)
Configurar secrets reales en Supabase (OpenAI, Google Vision, Firebase SA)
Quitar/corregir mención "PDF" de la suscripción Pro (#15 — mínimo cambiar el texto)
Unificar inicialización de notificaciones (#23)
Fase 2 — Features para producto competitivo
6. Implementar ReceiptRepository + pantalla de historial de recibos (#12)
7. Implementar transacciones recurrentes con UI (#13)
8. Agregar selector de cuenta destino en transferencias (#14)
9. Conectar daily reminder desde Settings (#16)
10. Mostrar cuota de IA restante al usuario (#17)

Fase 3 — iOS + Calidad
11. Configurar Firebase iOS completo: GoogleService-Info.plist, entitlements push (#2, #19)
12. Configurar RevenueCat iOS + productos en App Store Connect (#19)
13. Escribir tests unitarios/widget mínimos para flujos críticos (#20)
14. Migrar AppNotification a Freezed y limpiar ProfileSettings (#21, #22)

En resumen: Para Android, estás a ~5 tareas de configuración/corrección de poder publicar en Play Store. Para iOS necesitas toda la configuración de Firebase + RevenueCat + entitlements. Las features incompletas (recibos, recurrentes, transferencias, PDF, cuota IA) son necesarias para un producto de calidad comercial pero no bloquean un lanzamiento MVP.