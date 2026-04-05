-- ============================================================
-- WhatsApp Messages Log
-- Loguea todos los mensajes entrantes y salientes de WhatsApp
-- Ejecutar en: Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone           TEXT        NOT NULL,
  direction       TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type    TEXT        NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'image')),
  content         TEXT,
  intent          TEXT,
  transaction_id  UUID        REFERENCES public.transactions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_idx     ON public.whatsapp_messages(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_user_id_idx   ON public.whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_created_at_idx ON public.whatsapp_messages(created_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Solo el super admin puede leer/escribir
CREATE POLICY "Admin full access" ON public.whatsapp_messages
  FOR ALL USING (auth.jwt() ->> 'email' = 'jgomez@flowmind.app');

-- El service role (webhook) puede insertar sin restricciones (SECURITY DEFINER)
-- No se necesita policy extra: service role bypasses RLS
