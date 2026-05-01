# UX Validation — Banner WhatsApp phone

## Veredicto: APPROVED

## Checklist UX

### Consistencia visual
- [x] Colores: amber (#FBBF24) consistente con otros warnings en la app (ej: presupuestos superados).
- [x] Border radius 16px — consistente con otros cards del dashboard.
- [x] Fondo semi-transparente con opacity — consistente con el glassmorphism del resto de la UI.
- [x] Icono container con opacity 0.15 del color — mismo patron que _SettingsTile.
- [x] Typography: título 14px w700, subtítulo 12px opacity 0.5 — consistente con cards existentes.

### Posición en el dashboard
- [x] El banner aparece ANTES del contenido principal (balance card) — correcto para un aviso de configuración.
- [x] Hay espaciado `fromLTRB(20, 12, 20, 0)` — respeta los márgenes laterales de 20px del resto.
- [x] `SizedBox(height: 24)` empieza el contenido principal después — no hay solapamiento.

### Accesibilidad y usabilidad
- [x] Toda el área del banner es tappeable (GestureDetector wraps el Container completo).
- [x] Chevron derecho indica que es navegable — patrón familiar para el usuario.
- [x] Texto legible: contraste suficiente en modo oscuro.
- [x] No hay animaciones innecesarias — aparece/desaparece limpiamente cuando el estado cambia.

### Settings tile
- [x] Icono WhatsApp verde (#25D366) — color oficial de WhatsApp, reconocible.
- [x] Diálogo: hint text con formato de ejemplo (`+598 99 123 456`) — guía al usuario.
- [x] Keyboard type: `TextInputType.phone` — teclado numérico en mobile.
- [x] Sección "ASISTENTE WHATSAPP" correctamente ubicada entre "Uso de IA" y "Aplicación".

## Veredicto: APPROVED
