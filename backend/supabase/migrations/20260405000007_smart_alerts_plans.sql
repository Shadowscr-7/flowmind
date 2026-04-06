-- ============================================================
-- Smart Alerts & AI Insights enhancements
-- ============================================================

-- 1. smart_alerts: flexible user-defined alerts
CREATE TABLE IF NOT EXISTS public.smart_alerts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
    'spending_limit',   -- alert when category/total spending exceeds threshold in period
    'low_balance',      -- alert when account balance drops below threshold
    'weekly_summary',   -- opt-in weekly WhatsApp summary
    'goal_milestone',   -- alert when a goal reaches X% progress
    'unusual_spending'  -- AI-detected anomaly
  )),
  title         TEXT NOT NULL,
  category_id   UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id    UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  threshold_amount NUMERIC(15, 2),
  period        TEXT CHECK (period IN ('daily', 'weekly', 'monthly')),
  currency      TEXT NOT NULL DEFAULT 'UYU',
  notify_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
  notify_web      BOOLEAN NOT NULL DEFAULT TRUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_smart_alerts_user ON public.smart_alerts(user_id);
CREATE INDEX idx_smart_alerts_active ON public.smart_alerts(user_id, is_active);

ALTER TABLE public.smart_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own smart_alerts" ON public.smart_alerts
  FOR ALL USING (auth.uid() = user_id);

-- 2. Extend ai_insights: add source column to track origin (cron vs on-demand)
ALTER TABLE public.ai_insights
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'on_demand'
    CHECK (source IN ('on_demand', 'cron_weekly', 'cron_daily', 'alert_trigger'));

-- Rename detail → body if not already (keep backward compat with alias)
ALTER TABLE public.ai_insights
  ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ai_insights_user_created
  ON public.ai_insights(user_id, created_at DESC);
