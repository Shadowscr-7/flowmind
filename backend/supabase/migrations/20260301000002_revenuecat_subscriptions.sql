-- ============================================================
-- RevenueCat Subscription Integration
-- Adds unique constraint on subscriptions.user_id for upsert support
-- Adds revenuecat_id column and service role insert/update policies
-- ============================================================

-- Add unique constraint on user_id so we can upsert from webhook + client
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);

-- Add revenuecat_id column for cross-referencing
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS revenuecat_id TEXT;

-- Allow service role (webhook edge function) to INSERT subscriptions
CREATE POLICY "Service role can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);

-- Allow service role (webhook edge function) to UPDATE subscriptions
CREATE POLICY "Service role can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to insert their own subscription (from client-side sync)
CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own subscription
CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
