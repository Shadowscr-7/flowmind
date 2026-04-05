-- ============================================================
-- Remove free plan — all users are pro
-- ============================================================

-- Update any existing free users to pro
UPDATE public.profiles SET plan = 'pro' WHERE plan = 'free';

-- Update default and constraint
ALTER TABLE public.profiles
  ALTER COLUMN plan SET DEFAULT 'pro';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('pro'));
