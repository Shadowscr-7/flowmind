# Implementation — Banner WhatsApp phone faltante

## Cambios realizados

### 1. `app/lib/data/models/profile.dart`
Agregado campo `String? whatsappPhone` al final de los campos del factory constructor.
Mapeado a `whatsapp_phone` en la DB via `@JsonSerializable(fieldRename: FieldRename.snake)`.

### 2. `app/lib/data/models/profile.g.dart`
Actualizado `_$ProfileFromJson`: lee `json['whatsapp_phone'] as String?`.
Actualizado `_$ProfileToJson`: incluye `'whatsapp_phone': instance.whatsappPhone`.

### 3. `app/lib/data/models/profile.freezed.dart`
Actualizado todas las ocurrencias: mixin _$Profile, $ProfileCopyWith, _Profile class,
PatternExtension when/maybeWhen/whenOrNull/mapOrNull, toString, equals, hashCode.
El campo `whatsappPhone` es nullable `String?` con valor default null implícito.

### 4. `app/lib/presentation/screens/home/home_screen.dart`
- Agregado import de `app_config.dart`.
- En `_HomeTab.build()`: calculado `showWhatsappBanner` usando `profileAsync.whenOrNull`.
  - No se muestra en demo mode (`AppConfig.isDemoMode`).
  - Se muestra cuando `profile.whatsappPhone` es null o vacío.
- Agregado `SliverToBoxAdapter` con `_WhatsAppPhoneBanner` cuando `showWhatsappBanner == true`.
  - El banner navega a tab Ajustes (index 3) al tapearlo.
- Nueva clase `_WhatsAppPhoneBanner`: diseño consistente con el resto de la UI (dark bg,
  amber warning color, icono `warning_amber_rounded`, texto + chevron).

### 5. `app/lib/presentation/screens/settings/settings_screen.dart`
- Nueva sección "ASISTENTE WHATSAPP" entre "Uso de IA" y "Aplicación".
- Tile con icono WhatsApp verde (`0xFF25D366`), muestra número actual o "No configurado".
  Si no hay número, muestra badge "Pendiente" en amarillo.
- Nuevo método `_showWhatsAppPhoneDialog`: diálogo con campo phone, guarda en
  `profiles.whatsapp_phone` vía Supabase, invalida `profileProvider`.
  Acepta vacío para borrar el número.

## Edge cases cubiertos
- Demo mode: banner no aparece
- Profile cargando: banner no aparece (whenOrNull retorna null → false)
- Profile con phone vacío: banner aparece (trim().isEmpty)
- Phone guardado: banner desaparece al invalidar profileProvider
- Error de Supabase: snackbar de error, no crash
