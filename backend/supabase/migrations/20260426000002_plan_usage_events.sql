-- Monthly usage counters for Free plan media features.
-- A row is recorded when a user attempts to process a voice note or receipt
-- photo, so limits cannot be bypassed by analyzing and not saving.

CREATE TABLE IF NOT EXISTS public.plan_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('audio', 'image')),
  channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'whatsapp', 'mobile')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_usage_events_user_kind_created
  ON public.plan_usage_events(user_id, kind, created_at DESC);

ALTER TABLE public.plan_usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plan_usage_events' AND policyname='Users can view own usage events') THEN
    CREATE POLICY "Users can view own usage events"
      ON public.plan_usage_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plan_usage_events' AND policyname='Users can insert own usage events') THEN
    CREATE POLICY "Users can insert own usage events"
      ON public.plan_usage_events FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
