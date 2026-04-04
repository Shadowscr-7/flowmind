# Flowmind — Pre-Deploy Audit

> Generado: 14 de marzo de 2026 — Auditoría exhaustiva pre-producción

---

## 🔴 CRÍTICO — Resolver antes de hacer NADA

- [ ] **1. Rotar secretos expuestos** — `service_role` key, PostgreSQL password y admin password están hardcodeados en `setup_db.mjs`, `setup_db2.mjs`, `setup_full.mjs`, `setup_admin.mjs`, `migrate.mjs`, `migrate_notifications.mjs`, `run_migration_notifications.mjs`. Rotar **todo** desde Supabase Dashboard inmediatamente.
- [ ] **2. Gitignore scripts con secretos** — Agregar a `.gitignore`: `setup_*.mjs`, `migrate*.mjs`, `run_migration*.mjs`. Luego limpiar historial Git con `git filter-repo`.
- [ ] **3. Fix `source` CHECK constraint** — La columna `source` en `transactions` no admite `'recurring'` pero el cron `recurring-run` lo inserta. Ejecutar:
  ```sql
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
  ALTER TABLE transactions ADD CONSTRAINT transactions_source_check
    CHECK (source IN ('manual', 'text', 'voice', 'receipt', 'recurring'));
  ```
- [ ] **4. Admin panel sin autenticación** — `admin/src/app/layout.tsx` no tiene auth. Agregar `middleware.ts` con session check antes de deployar el admin.
- [ ] **5. `.next/` commiteado al repo** — Agregar `.next/` a `.gitignore` y borrar de Git (`git rm -r --cached admin/.next`).

---

## 🟠 ALTA — Resolver antes de subir AAB a Google Play

- [ ] **6. `android:allowBackup="false"`** — Agregar en `AndroidManifest.xml` dentro de `<application>`. App financiera no debe permitir backup ADB.
- [ ] **7. Ofuscación en release build** — Agregar `--obfuscate --split-debug-info=build/symbols` en `deploy.cmd` para las opciones release APK y AAB.
- [ ] **8. Signing: no fallback silencioso a debug** — En `app/android/app/build.gradle.kts`, si `key.properties` no existe el build debería fallar, no usar debug signing.
- [ ] **9. Hostear `privacy-policy.html`** — Subir `public/privacy-policy.html` a URL pública (GitHub Pages, Vercel, etc.) y pegar en Google Play Console → Policy.
- [ ] **10. Restringir Firebase API key** — En Google Cloud Console, restringir la API key de `google-services.json` por SHA-1 fingerprint y package name.
- [ ] **11. `google-services.json` a `.gitignore`** — Agregar `app/android/app/google-services.json` a `.gitignore` y distribuir via CI/CD.
- [ ] **12. CORS wildcard `*` en Edge Functions** — En `backend/supabase/functions/_shared/utils.ts`, cambiar `"Access-Control-Allow-Origin": "*"` por origen específico o eliminar (mobile-only no necesita CORS).
- [ ] **13. `insights-summary` sin quota check** — Agregar `checkAiQuota()` + `incrementAiUsage()` antes del `callLLM()` en `insights-summary/index.ts`.
- [ ] **14. Race condition en AI quota** — Cambiar `checkAiQuota` → `incrementAiUsage` por un UPDATE atómico:
  ```sql
  UPDATE profiles SET ai_usage_count = ai_usage_count + $1
  WHERE id = $2 AND ai_usage_count + $1 <= $quota
  RETURNING ai_usage_count;
  ```
- [ ] **15. Validar ownership de `transfer_to_account_id`** — Agregar trigger `BEFORE INSERT` o CHECK constraint que valide que `account_id` y `transfer_to_account_id` pertenezcan al mismo `user_id`.
- [ ] **16. Rate limiting en AI endpoints** — Implementar rate limit por usuario (ej: máx 5 req/min) en `ingest-text`, `ingest-voice`, `ingest-receipt`.
- [ ] **17. Migration scripts recrean policies inseguras** — Corregir `migrate_notifications.mjs` y `run_migration_notifications.mjs` para usar `WITH CHECK (auth.uid() = user_id)` en vez de `WITH CHECK (true)`.

---

## 🟡 MEDIA — Resolver antes de v1.1 o para compliance

- [ ] **18. Analytics opt-out (GDPR)** — `analytics_service.dart` siempre habilita analytics. Agregar mecanismo de consentimiento del usuario.
- [ ] **19. Logger silenciado en release** — Configurar `Logger(filter: ProductionFilter())` o equivalente para que no imprima en release.
- [ ] **20. Backup exporta JSON sin encriptar** — `backup_service.dart` escribe datos financieros como JSON plano. Encriptar el archivo de export.
- [ ] **21. Firebase App Check** — Implementar App Check para verificar que las requests a Edge Functions vengan de la app real.
- [ ] **22. ProGuard rules faltantes** — Agregar keep rules para `flutter_secure_storage` y `home_widget` en `proguard-rules.pro`.
- [ ] **23. Email confirmation deshabilitado** — En `backend/supabase/config.toml`, cambiar `enable_confirmations = true` para producción.
- [ ] **24. DELETE policy para `ai_insights`** — Agregar policy DELETE `ON ai_insights FOR DELETE USING (auth.uid() = user_id)`.
- [ ] **25. SELECT/DELETE policies para `analytics_events`** — Para compliance GDPR, usuarios deben poder ver y borrar sus propios eventos.
- [ ] **26. Composite indexes para cron queries** — Agregar:
  ```sql
  CREATE INDEX idx_tx_user_type_cat_date ON transactions(user_id, type, category_id, date);
  CREATE INDEX idx_tx_user_confirmed_date ON transactions(user_id, is_confirmed, date);
  CREATE INDEX idx_budgets_user_enabled ON budgets(user_id, enabled);
  ```
- [ ] **27. Cleanup cron de notifications** — Descomentar o crear cron para `DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'`.
- [ ] **28. Validación de longitud en AI endpoints** — Agregar max length check en `ingest-text` (ej: < 5000 chars), audio < 5MB, imagen < 10MB.
- [ ] **29. Error messages no filtrar internos** — En edge functions, loggear `error.message` server-side y retornar mensaje genérico al cliente.

---

## 🔵 BAJA — Nice to have / Cleanup

- [ ] **30. `appVersion` duplicado** — `app_config.dart` hardcodea `1.0.1`. Usar `package_info_plus` en runtime en vez del string estático.
- [ ] **31. `debugPrint` en código de producción** — 11 instancias en `login_screen.dart`, `onboarding_screen.dart`, `update_service.dart`, `backup_service.dart`. Aunque se stripean en release, limpiar.
- [ ] **32. Firebase Storage token permanente** — `version.json` tiene token que da acceso permanente al APK. Evaluar si es intencional.
- [ ] **33. Deno std@0.177.0 desactualizado** — Actualizar imports de `deno.land/std` en todas las Edge Functions.
- [ ] **34. Google Vision API key en URL** — `_shared/utils.ts` pasa API key como query param. Considerar header-based auth.
- [ ] **35. Admin panel 100% datos demo** — Todas las páginas usan datos hardcodeados. Wiring con Supabase queries reales.
- [ ] **36. Certificate pinning** — Recomendable para app financiera. Evaluar `ssl_pinning_plugin` o network security config.
- [ ] **37. `android:networkSecurityConfig`** — Agregar config explícita en AndroidManifest.
- [ ] **38. `ic_launcher_round` faltante** — Play Store espera icono redondo. Regenerar con `flutter_launcher_icons`.
- [ ] **39. TODO comment en Gradle** — Eliminar `// TODO: Specify your own unique Application ID` (cosmético).
- [ ] **40. Timing-safe comparison en cron auth** — `alerts-run`, `recurring-run`, `weekly-summary` usan `!==` para comparar service_role key. Usar comparación constant-time.

---

## ⚪ iOS — Pendiente completo (no bloquea Android)

- [ ] **41. `Info.plist` sin permission strings** — Faltan `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSFaceIDUsageDescription`, `NSPhotoLibraryUsageDescription`, etc.
- [ ] **42. `GoogleService-Info.plist` faltante** — Firebase no funcionará en iOS sin esto.
- [ ] **43. RevenueCat iOS config** — Falta configuración de productos en App Store Connect + key iOS en RevenueCat dashboard.
- [ ] **44. Entitlements y Apple Developer** — Push notifications, sign-in with Apple, etc.

---

## ✅ Lo que YA está bien

| Area | Estado |
|---|---|
| Secrets via `String.fromEnvironment()` en app | ✅ Correcto |
| RevenueCat key sin default value | ✅ Correcto |
| `.env` y `key.properties` gitignored | ✅ Correcto |
| SQLCipher + secure storage para DB local | ✅ Excelente |
| Crashlytics con `FlutterError.onError` + `runZonedGuarded` | ✅ Correcto |
| ProGuard/R8 habilitado con minify + shrink | ✅ Correcto |
| Google Fonts bundled (no runtime fetch) | ✅ Correcto |
| Push notification con `@pragma('vm:entry-point')` | ✅ Correcto |
| Privacy policy completa y Play Store ready | ✅ Excelente |
| Orientación portrait-only locked | ✅ Correcto |
| RevenueCat debug/release log levels | ✅ Correcto |
| RLS corregido en migration posterior | ✅ Correcto |
| 39 unit tests reales | ✅ Aceptable |
| Paginación con infinite scroll | ✅ Correcto |
| Compresión de imágenes antes de upload | ✅ Correcto |
| Cuota IA visible en UI | ✅ Correcto |

---

## Progreso

| Sección | Total | Completados |
|:--------|:-----:|:-----------:|
| 🔴 Crítico | 5 | 0 |
| 🟠 Alta | 12 | 0 |
| 🟡 Media | 12 | 0 |
| 🔵 Baja | 11 | 0 |
| ⚪ iOS | 4 | 0 |
| **Total** | **44** | **0** |
