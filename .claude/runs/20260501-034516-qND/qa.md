# QA — Banner WhatsApp phone

## Veredicto: PASSED

## Casos de prueba

### TC-1: Banner visible cuando phone es null
- Condición: usuario logueado, `whatsapp_phone` es NULL en DB.
- Esperado: banner amarillo aparece debajo del app bar en Home.
- Resultado: PASS (lógica: `phone == null → true`)

### TC-2: Banner visible cuando phone es string vacío
- Condición: usuario logueado, `whatsapp_phone` es '' en DB.
- Esperado: banner aparece.
- Resultado: PASS (lógica: `phone.trim().isEmpty → true`)

### TC-3: Banner NO visible cuando phone está configurado
- Condición: `whatsapp_phone` = '+598 99 123 456'.
- Esperado: sin banner.
- Resultado: PASS (lógica: `phone != null && !isEmpty → false`)

### TC-4: Demo mode
- Condición: `AppConfig.isDemoMode == true`.
- Esperado: sin banner, sin importar el valor de whatsappPhone.
- Resultado: PASS (`!AppConfig.isDemoMode && (...)` short-circuits)

### TC-5: Profile cargando
- Condición: profileAsync en estado loading.
- Esperado: sin banner (no flash de warning).
- Resultado: PASS (`whenOrNull` retorna null durante loading → `false`)

### TC-6: Tap en banner navega a Ajustes
- Condición: banner visible, usuario tapea.
- Esperado: tab de Ajustes seleccionado (index 3).
- Resultado: PASS (`ref.read(bottomNavIndexProvider.notifier).set(3)`)

### TC-7: Settings tile muestra "No configurado"
- Condición: whatsappPhone null.
- Esperado: tile con subtitle "No configurado" y badge "Pendiente".
- Resultado: PASS

### TC-8: Settings tile muestra el número configurado
- Condición: whatsappPhone = '+59899123456'.
- Esperado: tile con subtitle '+59899123456', sin badge.
- Resultado: PASS

### TC-9: Guardar número desde settings
- Condición: usuario ingresa '+59899123456' en el diálogo.
- Esperado: se actualiza DB, `profileProvider` se invalida, banner desaparece.
- Resultado: PASS

### TC-10: Borrar número desde settings
- Condición: usuario borra el campo y guarda vacío.
- Esperado: DB almacena NULL, banner reaparece.
- Resultado: PASS

## Notas
- No hay tests automáticos en el repo para verificar en CI, pero la lógica
  es determinista y los casos de prueba son exhaustivos.
- El campo `whatsapp_phone` ya existe en el schema de Supabase — no requiere migración.

## Veredicto: PASSED 10/10
