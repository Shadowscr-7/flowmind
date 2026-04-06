-- ============================================================
-- Support Tickets
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone         TEXT,                        -- for WhatsApp users
  display_name  TEXT,
  subject       TEXT NOT NULL,
  message       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority      TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source        TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'whatsapp')),
  admin_notes   TEXT,
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_tickets_user    ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status  ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created ON public.support_tickets(created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can create and read their own tickets
CREATE POLICY "Users manage own tickets" ON public.support_tickets
  FOR ALL USING (auth.uid() = user_id);

-- Service role can do everything (used by admin API and cron)
-- (service role bypasses RLS by default)
