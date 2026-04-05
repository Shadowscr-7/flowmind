-- Fix: Expand source CHECK constraint to include WhatsApp sources
-- The original constraint only allowed 'manual', 'text', 'voice', 'receipt'
-- but the WhatsApp webhook uses 'whatsapp', 'whatsapp_voice', 'whatsapp_image'

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'text', 'voice', 'receipt', 'whatsapp', 'whatsapp_voice', 'whatsapp_image'));
