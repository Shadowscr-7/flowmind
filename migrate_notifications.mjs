const SB_URL = 'https://kiubkipfzpnsnntjkxes.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdWJraXBmenBuc25udGpreGVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NTE3OCwiZXhwIjoyMDkwODUxMTc4fQ.F9c9JmLlBXHl4KdP-SXYVHHEZUFET9-UjGiX86TkbFs';
const hdrs = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'X-Connection-Encrypted': 'true' };

async function pgQuery(sql, label) {
  const r = await fetch(`${SB_URL}/pg-meta/default/query`, { method: 'POST', headers: hdrs, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  if (r.ok) console.log(`  ✔ ${label}`);
  else console.log(`  ✘ ${label}: ${r.status} ${text.substring(0, 200)}`);
}

async function run() {
  console.log('Running notifications migration...\n');

  await pgQuery('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;', 'Add fcm_token column');

  await pgQuery(`CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`, 'Create notifications table');

  await pgQuery('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);', 'Index user_id');
  await pgQuery('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);', 'Index created_at');
  await pgQuery('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);', 'Index is_read');
  await pgQuery('ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;', 'Enable RLS');

  await pgQuery(`CREATE POLICY "notif_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);`, 'RLS SELECT');
  await pgQuery(`CREATE POLICY "notif_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);`, 'RLS UPDATE');
  await pgQuery(`CREATE POLICY "notif_delete" ON public.notifications FOR DELETE USING (auth.uid() = user_id);`, 'RLS DELETE');
  await pgQuery(`CREATE POLICY "notif_insert" ON public.notifications FOR INSERT WITH CHECK (true);`, 'RLS INSERT');

  console.log('\n✅ Migration complete!');
}

run().catch(console.error);
