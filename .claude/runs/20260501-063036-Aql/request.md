BUG FIX (dos bugs en el asistente WhatsApp de FlowMind):

BUG 1 — Encoding roto en mensajes del bot:
Los mensajes del asistente de WhatsApp llegan con caracteres mal codificados. Ejemplo real recibido:
"ðŸ'‹ Â¡Hola! No encontrÃ© una cuenta de FlowMind asociada a este nÃºmero"
En lugar de:
"👋 ¡Hola! No encontré una cuenta de FlowMind asociada a este número"
El problema es probablemente que el texto se está enviando con encoding incorrecto (Latin-1 en lugar de UTF-8, o doble-encoding). Afecta emojis, tildes y caracteres especiales del español.

BUG 2 — Lógica inconsistente: da bienvenida pero luego dice que no encuentra cuenta:
Flujo real observado:
1. El bot envía mensaje de bienvenida al usuario ("¡Bienvenido a FlowMind, !") — lo que implica que SÍ encontró la sesión/usuario
2. El usuario responde "quiero registrar un gasto de 1000"
3. El bot responde que no encontró una cuenta de FlowMind asociada al número

Esto es contradictorio: si encontró el usuario para mostrar bienvenida, debería también encontrarlo para procesar gastos. Revisar la lógica de lookup del usuario por número de WhatsApp — probablemente el mensaje de bienvenida se envía sin validar que el número está vinculado, o hay dos paths de lookup distintos que no son consistentes.

Proyecto: E:\Proyectos\flowmind
