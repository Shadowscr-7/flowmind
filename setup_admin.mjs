import pg from 'pg';

const UID = '30037ced-49aa-4e9c-badc-d1e430fa5508';
const c = new pg.Client({
  host: 'aws-1-us-east-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.kiubkipfzpnsnntjkxes',
  password: '49618553Bmb328873!!',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await c.connect();
  console.log('Connected\n');

  // Check if profile exists (auto-created by trigger on signup)
  const r1 = await c.query('SELECT id, plan, display_name FROM public.profiles WHERE id = $1', [UID]);
  console.log('Profile exists:', r1.rows.length > 0);

  if (r1.rows.length === 0) {
    // Insert profile manually
    await c.query(
      `INSERT INTO public.profiles (id, display_name, plan, onboarding_completed)
       VALUES ($1, $2, $3, $4)`,
      [UID, 'J. Gomez', 'pro', true]
    );
    console.log('Profile INSERTED');
  } else {
    await c.query(
      `UPDATE public.profiles
       SET plan = 'pro', display_name = 'J. Gomez', onboarding_completed = true
       WHERE id = $1`,
      [UID]
    );
    console.log('Profile UPDATED');
  }

  // Verify profile
  const r2 = await c.query('SELECT id, display_name, plan, onboarding_completed FROM public.profiles WHERE id = $1', [UID]);
  console.log('Profile:', JSON.stringify(r2.rows[0], null, 2));

  // Create default account
  const r3 = await c.query('SELECT id FROM public.accounts WHERE user_id = $1', [UID]);
  if (r3.rows.length === 0) {
    await c.query(
      `INSERT INTO public.accounts (user_id, name, type, currency, initial_balance, current_balance, is_primary, icon, color)
       VALUES ($1, 'Efectivo', 'cash', 'UYU', 0, 0, true, 'wallet', '#4CAF50')`,
      [UID]
    );
    console.log('Account "Efectivo" CREATED');
  } else {
    console.log('Account already exists');
  }

  // Final verification
  const r4 = await c.query('SELECT name, type, currency, current_balance FROM public.accounts WHERE user_id = $1', [UID]);
  console.log('Accounts:', JSON.stringify(r4.rows));

  // Count all tables
  console.log('\n== Table Summary ==');
  const tables = ['profiles','accounts','categories','transactions','receipts','budgets','alerts','ai_insights','subscriptions','analytics_events'];
  for (const t of tables) {
    const r = await c.query(`SELECT COUNT(*) as cnt FROM public.${t}`);
    console.log(`  ${t.padEnd(20)} ${r.rows[0].cnt} rows`);
  }

  // Storage buckets
  const rb = await c.query('SELECT name FROM storage.buckets');
  console.log(`\nStorage buckets: ${rb.rows.map(r => r.name).join(', ')}`);

  // Global categories
  const rc = await c.query('SELECT name, type FROM public.categories WHERE user_id IS NULL ORDER BY sort_order');
  console.log(`\nGlobal categories (${rc.rows.length}):`);
  for (const cat of rc.rows) {
    console.log(`  ${cat.type === 'expense' ? 'Gasto' : 'Ingreso'}: ${cat.name}`);
  }

  await c.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
