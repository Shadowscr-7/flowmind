-- Add WhatsApp phone number to profiles for Evolution API integration
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- Index for fast lookup by phone number (used by whatsapp-webhook edge function)
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_phone ON profiles(whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL;
