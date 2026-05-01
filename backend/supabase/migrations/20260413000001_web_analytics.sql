-- ──────────────────────────────────────────────────────────────────────────────
-- Web visitor analytics: track every page view on the public website
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.web_visits (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      TEXT        NOT NULL,          -- random ID per browser tab session
  ip              TEXT,                          -- visitor IP (from x-forwarded-for)
  user_agent      TEXT,                          -- raw User-Agent header
  page            TEXT        NOT NULL,          -- pathname, e.g. "/"
  referrer        TEXT,                          -- where they came from
  utm_source      TEXT,                          -- e.g. "facebook"
  utm_medium      TEXT,                          -- e.g. "cpc"
  utm_campaign    TEXT,                          -- e.g. "spring_promo"
  utm_content     TEXT,                          -- e.g. "banner_v2"
  duration_seconds INTEGER,                      -- time on page (sent on leave)
  is_bot          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS; only the service role (backend) can touch this table
ALTER TABLE public.web_visits ENABLE ROW LEVEL SECURITY;

-- Deny all access via anon/user JWT — the API endpoint uses service role
CREATE POLICY "web_visits_service_only" ON public.web_visits
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS web_visits_created_at_idx  ON public.web_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS web_visits_session_idx     ON public.web_visits (session_id);
CREATE INDEX IF NOT EXISTS web_visits_page_idx        ON public.web_visits (page);
CREATE INDEX IF NOT EXISTS web_visits_ip_idx          ON public.web_visits (ip);
CREATE INDEX IF NOT EXISTS web_visits_utm_source_idx  ON public.web_visits (utm_source);
CREATE INDEX IF NOT EXISTS web_visits_is_bot_idx      ON public.web_visits (is_bot);
