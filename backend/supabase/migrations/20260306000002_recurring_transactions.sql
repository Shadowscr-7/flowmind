-- ============================================================
-- Recurring Transactions Support
-- ============================================================
-- Adds recurrence metadata columns and a recurring_rules table
-- for tracking when to auto-generate the next occurrence.
-- ============================================================

-- Add recurrence metadata to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS recurring_day INTEGER,
  ADD COLUMN IF NOT EXISTS recurring_end_date DATE;

-- Recurring rules table — tracks active recurring transactions
CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UYU',
  merchant TEXT,
  notes TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  day_of_period INTEGER,            -- day of week (1-7) or day of month (1-31)
  next_occurrence DATE NOT NULL,
  end_date DATE,                     -- NULL = infinite
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  transfer_to_account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_rules_user ON public.recurring_rules(user_id);
CREATE INDEX idx_recurring_rules_next ON public.recurring_rules(next_occurrence) WHERE is_active = TRUE;

CREATE TRIGGER recurring_rules_updated_at
  BEFORE UPDATE ON public.recurring_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring rules"
  ON public.recurring_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring rules"
  ON public.recurring_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring rules"
  ON public.recurring_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring rules"
  ON public.recurring_rules FOR DELETE
  USING (auth.uid() = user_id);
