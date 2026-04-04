// Setup Flowmind database on Supabase
const SB_URL = 'https://kiubkipfzpnsnntjkxes.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdWJraXBmenBuc25udGpreGVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NTE3OCwiZXhwIjoyMDkwODUxMTc4fQ.F9c9JmLlBXHl4KdP-SXYVHHEZUFET9-UjGiX86TkbFs';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

// Check if table exists by trying to query it
async function tableExists(table) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?select=id&limit=1`, { headers });
    return r.ok;
  } catch { return false; }
}

// Run SQL via the pg-meta API (Supabase exposes this)
async function runSQL(sql) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`SQL error ${r.status}: ${text}`);
  }
  return await r.json();
}

async function main() {
  console.log('=== Checking existing tables ===');
  
  const tables = ['profiles', 'accounts', 'categories', 'transactions', 'receipts', 'budgets', 'alerts', 'ai_insights', 'subscriptions', 'analytics_events'];
  
  for (const t of tables) {
    const exists = await tableExists(t);
    console.log(`  ${t}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
  }

  console.log('\n=== Checking auth users ===');
  try {
    // List users via Supabase Auth Admin API
    const r = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=10`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    });
    if (r.ok) {
      const data = await r.json();
      const users = data.users || data;
      console.log(`  Found ${Array.isArray(users) ? users.length : 0} users`);
      if (Array.isArray(users)) {
        users.forEach(u => console.log(`    - ${u.email} (${u.id})`));
      }
    } else {
      console.log(`  Auth API error: ${r.status} ${await r.text()}`);
    }
  } catch (e) {
    console.log(`  Auth check error: ${e.message}`);
  }
}

main().catch(e => console.error(e));
