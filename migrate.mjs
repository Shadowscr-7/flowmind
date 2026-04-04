// ╔═══════════════════════════════════════════════════════════╗
// ║  Flowmind – Direct PostgreSQL Migration                    ║
// ║  Connects to Supabase DB and runs all migration SQL        ║
// ╚═══════════════════════════════════════════════════════════╝
import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_USER_ID = '30037ced-49aa-4e9c-badc-d1e430fa5508';

// Password has special chars - must be URL-encoded: !! → %21%21
const DB_PASS = '49618553Bmb328873%21%21';
const REF = 'kiubkipfzpnsnntjkxes';

const CONFIGS = [
  { label: 'US East 2 - Session Pooler', url: `postgresql://postgres.${REF}:${DB_PASS}@aws-1-us-east-2.pooler.supabase.com:5432/postgres` },
];

async function connectDB() {
  for (const cfg of CONFIGS) {
    try {
      process.stdout.write(`  ${cfg.label}... `);
      const c = new pg.Client({ connectionString: cfg.url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
      await c.connect();
      console.log('CONNECTED');
      return c;
    } catch (e) {
      console.log(`${e.message.substring(0, 60)}`);
    }
  }
  return null;
}

function splitSQL(sql) {
  const results = [];
  let current = '';
  let inDollar = false;
  let dollarTag = '';
  for (const line of sql.split('\n')) {
    const matches = line.match(/\$[a-zA-Z_]*\$/g);
    if (matches) {
      for (const m of matches) {
        if (!inDollar) { inDollar = true; dollarTag = m; }
        else if (m === dollarTag) { inDollar = false; dollarTag = ''; }
      }
    }
    current += line + '\n';
    if (!inDollar && line.trimEnd().endsWith(';')) {
      results.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) results.push(current.trim());
  return results.filter(s => s && !s.match(/^--[^\n]*$/));
}

async function main() {
  console.log('Flowmind Database Migration\n');
  console.log('Connecting to Supabase PostgreSQL...');
  
  const client = await connectDB();
  if (!client) { console.error('\nCould not connect to any endpoint'); process.exit(1); }

  const m1 = readFileSync(join(__dirname, 'backend/supabase/migrations/20260225000001_initial_schema.sql'), 'utf-8');
  const m2 = readFileSync(join(__dirname, 'backend/supabase/migrations/20260225000002_storage_setup.sql'), 'utf-8');

  // Migration 1: Schema
  console.log('\n== Migration 1: Schema + Seed ==');
  const stmts1 = splitSQL(m1);
  let ok1 = 0, fail1 = 0;
  for (const stmt of stmts1) {
    try {
      await client.query(stmt);
      ok1++;
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate')) { ok1++; continue; }
      fail1++;
      console.log(`  WARN: ${e.message.substring(0, 120)}`);
      console.log(`    SQL: ${stmt.substring(0, 80)}...`);
    }
  }
  console.log(`  Result: ${ok1} ok, ${fail1} failed (${stmts1.length} total)`);

  // Migration 2: Storage
  console.log('\n== Migration 2: Storage Buckets ==');
  const stmts2 = splitSQL(m2);
  let ok2 = 0, fail2 = 0;
  for (const stmt of stmts2) {
    try {
      await client.query(stmt);
      ok2++;
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate')) { ok2++; continue; }
      fail2++;
      console.log(`  WARN: ${e.message.substring(0, 120)}`);
    }
  }
  console.log(`  Result: ${ok2} ok, ${fail2} failed (${stmts2.length} total)`);

  // Admin profile
  console.log('\n== Admin Profile Setup ==');
  try {
    await client.query(`UPDATE public.profiles SET plan='pro', display_name='J. Gomez', onboarding_completed=true WHERE id='${ADMIN_USER_ID}'`);
    console.log('  OK: Profile -> pro plan');
  } catch (e) { console.log(`  WARN: ${e.message}`); }
  try {
    await client.query(`INSERT INTO public.accounts (user_id, name, type, currency, initial_balance, current_balance, is_primary, icon, color) VALUES ('${ADMIN_USER_ID}','Efectivo','cash','UYU',0,0,true,'wallet','#4CAF50') ON CONFLICT DO NOTHING`);
    console.log('  OK: Default account Efectivo');
  } catch (e) { console.log(`  WARN: ${e.message}`); }

  // Verify
  console.log('\n== Verification ==');
  const tables = ['profiles','accounts','categories','transactions','receipts','budgets','alerts','ai_insights','subscriptions','analytics_events'];
  for (const t of tables) {
    try {
      const r = await client.query(`SELECT COUNT(*) as cnt FROM public.${t}`);
      console.log(`  OK: ${t.padEnd(20)} ${r.rows[0].cnt} rows`);
    } catch (e) {
      console.log(`  FAIL: ${t.padEnd(20)} ${e.message.substring(0, 50)}`);
    }
  }
  try {
    const r = await client.query(`SELECT id, name FROM storage.buckets`);
    console.log(`  Buckets: ${r.rows.map(b => b.name).join(', ') || 'none'}`);
  } catch (e) { console.log(`  Buckets: ${e.message.substring(0, 50)}`); }
  try {
    const r = await client.query(`SELECT display_name, plan, onboarding_completed FROM public.profiles WHERE id='${ADMIN_USER_ID}'`);
    if (r.rows.length) { const p = r.rows[0]; console.log(`  Admin: ${p.display_name} | plan=${p.plan} | onboarded=${p.onboarding_completed}`); }
  } catch (e) {}
  try {
    const r = await client.query(`SELECT COUNT(*) as cnt FROM public.categories WHERE user_id IS NULL`);
    console.log(`  Global categories: ${r.rows[0].cnt}`);
  } catch (e) {}

  console.log('\n===================================');
  console.log('Admin Login:');
  console.log('  Email:    jgomez@flowmind.app');
  console.log('  Password: Flowmind2026!');
  console.log('===================================\n');

  await client.end();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
