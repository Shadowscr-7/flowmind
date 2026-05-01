# Implementation — 20260501-063036-Aql

## Cambios aplicados

### Archivo: backend/supabase/functions/whatsapp-webhook/index.ts

#### Fix Bug 1 — Encoding UTF-8
- Funcion `sendWhatsApp()`: cambiado header de `"Content-Type": "application/json"` a `"Content-Type": "application/json; charset=utf-8"`
- Funcion `downloadMediaFromEvolution()`: mismo fix aplicado por consistencia
- Funcion ingest-receipt fetch interno: mismo fix aplicado

#### Fix Bug 2 — Lookup de usuario por numero de WhatsApp
- Eliminada la query inline `.or()` del main handler
- Extraida nueva funcion `findProfileByPhone(db, rawPhone)` con logica de busqueda en 3 intentos:
  1. Match exacto con + prefix (ej: "+59899123456") — cubre el caso normal
  2. Match exacto sin + prefix (ej: "59899123456") — cubre numeros guardados sin +
  3. Match por sufijo de ultimos 9 digitos via `.like("whatsapp_phone", "%<suffix>")` — cubre discrepancias de formato de codigo de pais
  - El sufijo match solo se usa si retorna exactamente 1 resultado (evita ambiguedad)
- Funcion auxiliar `digitsOnly(phone)` para normalizar a solo digitos
- Agregado `console.log` cuando profile no se encuentra: loggea el rawPhone para diagnostico

#### Otros
- Cambiado `.single()` a `.maybeSingle()` en la query exacta para evitar error cuando no hay resultado (fix defensivo)
- Mantenido el estilo de codigo existente (Deno, TypeScript, ESM imports)
- No se tocaron otros flujos (imagen, audio, texto, quota, confirmacion)

## LOC estimados
- Lineas modificadas: ~30
- Lineas agregadas: ~45 (nueva funcion findProfileByPhone + digitsOnly)
- Lineas eliminadas: ~8 (query inline reemplazada)
