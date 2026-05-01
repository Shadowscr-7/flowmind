# Lessons — 20260501-063036-Aql

## Pedido
Fix encoding roto + logica inconsistente (welcome pero no encuentra cuenta) en el asistente WhatsApp de FlowMind.

## Bucket inicial
bug-fix (forzado via --bucket=bug-fix)

## Resumen del path
spec-inline → implementer (sonnet) → code-reviewer (sonnet) → qa-tester (sonnet) → APPROVED/PASSED

## Patrones detectados
- Cuando se envia JSON a la Evolution API desde Deno, incluir `charset=utf-8` en el Content-Type
  es necesario para que emojis y caracteres especiales del español no lleguen corruptos.
  Pattern: siempre `"Content-Type": "application/json; charset=utf-8"` en fetches externos con texto unicode.
- Para lookups de numeros de telefono en WhatsApp, el formato puede variar entre como lo guarda
  el usuario (ej: "099123456") y como lo envia Evolution API (ej: "59899123456" con codigo de pais).
  Pattern: lookup en 3 capas: exacto-con+, exacto-sin+, sufijo-ultimos-9-digitos con ambiguedad check.
- Usar `.maybeSingle()` en vez de `.single()` en Supabase cuando el resultado puede ser 0 filas
  (`.single()` lanza error en ese caso). Pattern: siempre maybeSingle para lookups opcionales.

## Metrica clave
- Iteraciones: 1
- Tokens totales estimados: 19100
- Costo estimado: $0.12
- Escalacion al arbiter: no
- Escalacion al humano: no
