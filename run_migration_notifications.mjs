// Run migration: Add fcm_token + notifications table
const SB_URL = 'https://kiubkipfzpnsnntjkxes.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdWJraXBmenBuc25udGpreGVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NTE3OCwiZXhwIjoyMDkwODUxMTc4fQ.F9c9JmLlBXHl4KdP-SXYVHHEZUFET9-UjGiX86TkbFs';

const headers = {
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

async function run() {
  // 1. Check if notifications table exists
  const r1 = await fetch(`${SB_URL}/rest/v1/notifications?select=id&limit=1`, { headers });
  console.log('Notifications table check:', r1.status, r1.status === 200 ? 'EXISTS' : 'NOT FOUND');

  // 2. Check if fcm_token column exists
  const r2 = await fetch(`${SB_URL}/rest/v1/profiles?select=fcm_token&limit=1`, { headers });
  console.log('fcm_token column check:', r2.status, r2.status === 200 ? 'EXISTS' : 'NOT FOUND');

  // If table doesn't exist, we need to create it via SQL
  if (r1.status !== 200 || r2.status !== 200) {
    console.log('\n--- MANUAL SQL NEEDED ---');
    console.log('Run this SQL in Supabase Dashboard > SQL Editor:\n');
    console.log(`
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);
    `);
  } else {
    console.log('\n✅ Both notifications table and fcm_token column already exist!');
  }
}

run().catch(console.error);
