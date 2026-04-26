-- Restore the Free plan as the default acquisition tier.
-- Free is intentionally limited: no AI analysis, 2 voice messages/month,
-- and 3 receipt photos/month. Product code enforces the media limits.

ALTER TABLE public.profiles
  ALTER COLUMN plan SET DEFAULT 'free';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'pro'));
