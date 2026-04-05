-- ============================================================
-- WhatsApp Pending State
-- Guarda transacciones esperando selección de cuenta
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_pending (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  phone       TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pending_type TEXT       NOT NULL DEFAULT 'account_selection',
  payload     JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS whatsapp_pending_phone_idx ON public.whatsapp_pending(phone, expires_at);

ALTER TABLE public.whatsapp_pending ENABLE ROW LEVEL SECURITY;
-- Solo service role accede (webhook usa service key, bypasses RLS)
