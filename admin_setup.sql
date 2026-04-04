-- ============================================================
-- Flowmind – Admin User Setup
-- Run this AFTER schema.sql in the Supabase SQL editor
-- El user jgomez@flowmind.app ya fue creado via Auth API
-- con ID: b3ec37ea-7a78-4198-abac-a23ff2ef49d9
-- ============================================================

-- Crear el profile manualmente (el trigger no existía cuando se creó el user)
INSERT INTO public.profiles (id, display_name, plan, onboarding_completed)
VALUES (
  'b3ec37ea-7a78-4198-abac-a23ff2ef49d9',
  'J. Gomez',
  'pro',
  true
)
ON CONFLICT (id) DO UPDATE
  SET display_name = 'J. Gomez',
      plan = 'pro',
      onboarding_completed = true;

-- Crear cuenta de efectivo por defecto
INSERT INTO public.accounts (user_id, name, type, currency, initial_balance, balance, is_primary, icon, color)
VALUES (
  'b3ec37ea-7a78-4198-abac-a23ff2ef49d9',
  'Efectivo',
  'cash',
  'UYU',
  0,
  0,
  true,
  'wallet',
  '#4CAF50'
)
ON CONFLICT DO NOTHING;
