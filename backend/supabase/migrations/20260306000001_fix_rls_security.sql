-- ============================================================
-- Security Fix: Tighten RLS policies for notifications and subscriptions
-- ============================================================
-- Date: 2026-03-06
-- Issue: notifications INSERT and subscriptions INSERT/UPDATE had
--        WITH CHECK (true) allowing any authenticated user to write
--        records for other users. Edge functions use service_role
--        which bypasses RLS, so they don't need open policies.
-- ============================================================

-- ─── NOTIFICATIONS: Fix INSERT policy ───────────────────────

-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

-- Only allow users to insert notifications for themselves
-- Edge functions use service_role key which bypasses RLS entirely
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── SUBSCRIPTIONS: Fix INSERT/UPDATE policies ──────────────

-- Drop the overly permissive service role policies
DROP POLICY IF EXISTS "Service role can insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.subscriptions;

-- The user-scoped policies from the same migration are fine:
--   "Users can insert own subscriptions" WITH CHECK (auth.uid() = user_id)
--   "Users can update own subscriptions" USING/WITH CHECK (auth.uid() = user_id)
-- Edge functions use service_role key which bypasses RLS entirely.
-- No additional open policies needed.
