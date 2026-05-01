# Lessons — 20260501-034516-qND

## Pedido
Banner en dashboard cuando usuario no tiene whatsapp_phone configurado.

## Bucket inicial
small-feature

## Resumen del path
triage (inline) → analyst-inline → implementer → code-reviewer → qa → ux → APPROVED

## Patrones detectados
- Cuando se agrega un campo al modelo freezed de Flutter, los 3 archivos
  (profile.dart, profile.g.dart, profile.freezed.dart) deben actualizarse
  manualmente si no se puede correr build_runner. Todos los métodos where/when/
  maybeWhen/whenOrNull/copyWith deben incluir el nuevo campo.
- Para banners condicionales en Flutter con Riverpod: usar `whenOrNull` en vez
  de `when` evita tener que manejar los casos loading/error — retorna null
  que se puede colapsar a false con `?? false`.
- Siempre agregar `!AppConfig.isDemoMode` como primera condición para banners
  que dependan de datos del usuario real — el demo mode usa un profile sin datos reales.
- El campo `whatsapp_phone` ya existía en el schema de Supabase pero no en el
  modelo Flutter. Pattern a recordar: verificar schema.sql antes de asumir que
  un campo nuevo requiere migración.

## Metrica clave
- Iteraciones: 1
- Tokens totales estimados: 47000
- Costo estimado: $0.12
- Escalacion al arbiter: no
- Escalacion al humano: no
