# Spec mínima (inline orquestador): Banner de teléfono faltante en Dashboard

## Pedido literal
Si el usuario no tiene celular en configuración (y no es root/admin) → mostrar en el
dashboard una sección con icono de "!" recomendando colocar número de teléfono para
poder usar el asistente de WhatsApp.

## Síntoma reportado
No existe ninguna indicación en el dashboard cuando el usuario no tiene su número de
WhatsApp configurado. El asistente de WhatsApp no puede funcionar sin ese dato.

## Contexto técnico inferido
- `Profile` model en `app/lib/data/models/profile.dart` no tiene campo `whatsappPhone`.
- El campo `whatsapp_phone` SÍ existe en la DB (declarado en schema.sql).
- "No es root" = no hay concepto de root en el app Flutter → la condición es
  `profile.whatsappPhone == null || profile.whatsappPhone!.trim().isEmpty`.
- En demo mode no se muestra el banner (profile es demo).

## Acceptance criteria
- [ ] El modelo `Profile` tiene campo `whatsappPhone: String?` mapeado a `whatsapp_phone`.
- [ ] Los archivos `profile.g.dart` y `profile.freezed.dart` están actualizados consistentemente.
- [ ] En el tab Inicio del dashboard, si el profile está cargado y `whatsappPhone` es null/vacío,
      se muestra un banner warning con:
      - Icono de advertencia (Icons.warning_amber_rounded o similar)
      - Título: "Configura tu número de WhatsApp"
      - Subtítulo: "Para usar el asistente de WhatsApp necesitás registrar tu número en Ajustes."
      - Botón/enlace que navega a la tab de Ajustes (index 3)
- [ ] El banner no se muestra si `whatsappPhone` está configurado.
- [ ] El banner no se muestra en demo mode.
- [ ] En la pantalla de Ajustes, existe un tile para editar el número de WhatsApp
      (dentro del perfil o sección separada) que actualiza `whatsapp_phone` en Supabase.

## Áreas afectadas (de triage)
- `app/lib/data/models/profile.dart` — agregar campo
- `app/lib/data/models/profile.freezed.dart` — actualizar código generado
- `app/lib/data/models/profile.g.dart` — actualizar serialización
- `app/lib/presentation/screens/home/home_screen.dart` — agregar banner en _HomeTab
- `app/lib/presentation/screens/settings/settings_screen.dart` — agregar tile WhatsApp phone
