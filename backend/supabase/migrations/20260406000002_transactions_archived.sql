-- Add is_archived column to transactions for soft-delete support
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast filtering of non-archived transactions
CREATE INDEX IF NOT EXISTS transactions_is_archived_idx
  ON public.transactions (user_id, is_archived);
