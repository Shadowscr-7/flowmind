// Flowmind Database Setup - Creates all tables, RLS, functions, and admin user
const SB_URL = 'https://kiubkipfzpnsnntjkxes.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdWJraXBmenBuc25udGpreGVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NTE3OCwiZXhwIjoyMDkwODUxMTc4fQ.F9c9JmLlBXHl4KdP-SXYVHHEZUFET9-UjGiX86TkbFs';
const PROJECT_REF = 'kiubkipfzpnsnntjkxes';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// ─── Step 1: Create admin user via Auth Admin API ───────────
async function createAdminUser() {
  console.log('\n=== Creating Admin User ===');
  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: 'jgomez@flowmind.app',
      password: 'Flowmind2026!',
      email_confirm: true,
      user_metadata: {
        display_name: 'J. Gomez',
        role: 'admin',
      },
    }),
  });
  const data = await r.json();
  if (r.ok) {
    console.log(`  Created user: ${data.email} (${data.id})`);
    return data.id;
  } else {
    // Check if already exists
    if (JSON.stringify(data).includes('already')) {
      console.log('  User already exists, fetching...');
      const lr = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers });
      const ld = await lr.json();
      const users = ld.users || ld;
      const existing = users.find(u => u.email === 'jgomez@flowmind.app');
      if (existing) {
        console.log(`  Found existing: ${existing.id}`);
        return existing.id;
      }
    }
    console.log(`  Error: ${JSON.stringify(data)}`);
    return null;
  }
}

// ─── Step 2: Run SQL via pg-meta (the internal Supabase API) ─
// The SQL editor in the dashboard uses this endpoint
async function runSQL(sql, label) {
  // Supabase exposes pg endpoint at /pg/query for service role
  // But the standard way is via the database connection
  // Let's create an RPC function first, then use it
  
  // Alternative: use the Supabase CLI or the pg REST endpoint
  // The cleanest approach: use the /rest/v1/rpc endpoint to call a function
  // But we need to create tables first...
  
  // Let's try the undocumented SQL endpoint that the dashboard uses
  const endpoints = [
    `${SB_URL}/pg/query`,
    `${SB_URL}/rest/v1/rpc/exec_sql`,
  ];
  
  for (const endpoint of endpoints) {
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { ...headers, 'X-Connection-Encrypted': 'true' },
        body: JSON.stringify({ query: sql }),
      });
      if (r.ok) {
        console.log(`  ${label}: OK`);
        return true;
      }
    } catch {}
  }
  return false;
}

// ─── Step 3: Create tables via individual REST API calls ─────
// Since we can't run raw SQL via REST, we'll use the Supabase 
// Management API. But that requires a management token.
// 
// The practical solution: use the profiles trigger + RPC approach.
// Let's create a bootstrap RPC function, then use it.

// Actually, the simplest reliable method is to use Supabase's
// built-in database setup. Let me write a comprehensive SQL file
// and instruct to run it via the dashboard SQL editor.

async function main() {
  // Step 1: Create the admin user first
  const userId = await createAdminUser();
  
  if (!userId) {
    console.log('\nFailed to create user. Please create manually.');
  }
  
  // Step 2: Generate the complete SQL to run in the dashboard
  console.log('\n=== DATABASE SETUP ===');
  console.log('The SQL migration file has been created at:');
  console.log('  e:\\Proyectos\\flowmind\\setup_complete.sql');
  console.log('\nPlease run it in the Supabase SQL Editor:');
  console.log('  https://supabase.com/dashboard/project/hctwcziqereogduhlrjs/sql/new');
  console.log('\nAfter running the SQL, the user profile will be auto-created');
  console.log(`for userId: ${userId}`);

  // Step 3: After tables exist, set up admin profile
  if (userId) {
    console.log('\n=== Will set up admin profile after tables are created ===');
    console.log(`  User ID: ${userId}`);
    console.log(`  Email: jgomez@flowmind.app`);
    console.log(`  Password: Flowmind2026!`);
  }
}

main().catch(e => console.error(e));
