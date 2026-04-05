-- Add is_active column to accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS accounts_is_active_idx ON public.accounts(user_id, is_active);
