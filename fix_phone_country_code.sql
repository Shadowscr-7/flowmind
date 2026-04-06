-- ============================================================
-- Fix: agregar +598 a números de WhatsApp sin código de país
-- Ejecutar en: https://supabase.com/dashboard/project/kiubkipfzpnsnntjkxes/sql/new
-- ============================================================

-- 1. Preview: ver qué registros se van a modificar
SELECT
  id,
  whatsapp_phone AS actual,
  '+598' || whatsapp_phone AS resultado
FROM public.profiles
WHERE
  whatsapp_phone IS NOT NULL
  AND whatsapp_phone <> ''
  AND whatsapp_phone NOT LIKE '+%';

-- ============================================================
-- 2. Aplicar la corrección (descomentar cuando estés conforme con el preview)
-- ============================================================
/*
UPDATE public.profiles
SET whatsapp_phone = '+598' || whatsapp_phone
WHERE
  whatsapp_phone IS NOT NULL
  AND whatsapp_phone <> ''
  AND whatsapp_phone NOT LIKE '+%';
*/
