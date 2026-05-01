# QA — 20260501-063036-Aql

## Veredicto: PASSED

## Acceptance Criteria

### AC1 — Mensajes llegan con charset correcto
PASS. sendWhatsApp usa charset=utf-8. JSON.stringify en Deno produce UTF-8 nativo.
Evolution API tendra el hint correcto para interpretar emojis y tildes.

### AC2 — Content-Type incluye charset=utf-8
PASS. Confirmado en linea 343 del archivo modificado.
Tambien aplicado en downloadMediaFromEvolution y fetch interno de ingest-receipt.

### AC3 — Lookup cubre 3 variantes de formato
PASS. findProfileByPhone: exacto-con+, exacto-sin+, sufijo-9-digitos.
Ambiguedad en sufijo manejada con limit(2) + check length===1.

### AC4 — Log del numero cuando no se encuentra perfil
PASS. console.log en linea 127 del archivo modificado.

### AC5 — Sin regresiones en flujos existentes
PASS. Texto, imagen, audio, quota, confirmacion — sin cambios funcionales.

## Edge cases verificados
- rawPhone vacio: suffix length < 7 → null → onboarding. OK.
- rawPhone con + prefijo: manejado en phoneWithPlus/phoneWithoutPlus. OK.
- Multiple matches en sufijo: limit(2), length !== 1 → null. OK.
- maybeSingle con 0 resultados: retorna { data: null }, no lanza error. OK.

## PASSED — 5/5 AC cumplidos
