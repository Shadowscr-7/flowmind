# Spec minima (inline orquestador): Fix encoding + logica inconsistente en whatsapp-webhook

## Pedido literal
BUG 1 - Encoding roto en mensajes del bot: Los mensajes llegan con caracteres mal codificados.
Ejemplo: "ðŸ'‹ Â¡Hola!" en vez de "👋 ¡Hola!"
BUG 2 - Logica inconsistente: bot da bienvenida pero luego dice que no encuentra cuenta.

## Sintoma reportado

### Bug 1
- Los mensajes enviados via Evolution API llegan con UTF-8 interpretado como Latin-1
- Afecta emojis, tildes y caracteres especiales del español
- Patron tipico de doble-encoding o charset no especificado
- La funcion sendWhatsApp usa fetch con Content-Type: application/json sin charset=utf-8

### Bug 2
- Usuario recibe mensaje de bienvenida (implica que el sistema SÍ conoce al usuario)
- En el siguiente mensaje, el bot responde que no encuentra cuenta vinculada
- El mensaje "no encontre cuenta" coincide literalmente con la rama `if (!profile)` del codigo
- Causa probable: el numero almacenado en profiles.whatsapp_phone no matchea el formato
  que llega de Evolution API en mensajes subsiguientes
- O bien: hay un mecanismo externo (trigger de DB, otra funcion) que envia el welcome usando
  el user_id directamente, independientemente del whatsapp_phone lookup

## Root cause analisis

### Bug 1 — Fix
Archivo: backend/supabase/functions/whatsapp-webhook/index.ts
Funcion: sendWhatsApp()
Fix: Agregar `; charset=utf-8` al Content-Type del fetch a Evolution API.
Tambien verificar si el texto de las respuestas hardcodeadas tiene caracteres bien codificados.

### Bug 2 — Fix
Archivo: backend/supabase/functions/whatsapp-webhook/index.ts
El OR query actual: `.or("whatsapp_phone.eq.${phoneWithPlus},whatsapp_phone.eq.${phoneWithoutPlus}")`
Cubre +NNNN y NNNN pero NO cubre:
  - numeros con espacios (ej: "+598 9 123 4567")
  - numeros de 15 digitos con doble codigo de pais (ej: "595959812345678")
  - numeros almacenados con formato diferente al esperado

Fix principal: normalizar el numero antes del lookup. Extraer solo digitos, intentar
multiples variantes (con y sin codigo de pais), usar LIKE o funcion de normalizacion.
Fix alternativo mas simple y robusto: agregar una tercera variante que busque por
sufijo de los ultimos 8 digitos del numero (lo mas especifico que puede variar menos).

Adicionalmente, agregar logging del rawPhone en el path `!profile` para diagnostico futuro.

## Acceptance criteria
- [ ] Los mensajes enviados al usuario via Evolution API llegan con caracteres correctos (tildes, emojis, ñ)
- [ ] El Content-Type del fetch a Evolution incluye charset=utf-8
- [ ] El lookup de usuario por whatsapp_phone cubre al menos 3 variantes de formato del numero
- [ ] Si el profile no se encuentra, se loggea el numero que se busco (para debugging)
- [ ] No se rompen los flujos existentes (texto, imagen, ayuda, quota)

## Areas afectadas
- backend/supabase/functions/whatsapp-webhook/index.ts (funciones sendWhatsApp y lookup)
