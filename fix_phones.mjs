// ╔═══════════════════════════════════════════════════════════╗
// ║  fix_phones.mjs                                            ║
// ║  Agrega +598 a números de WhatsApp sin código de país      ║
// ╚═══════════════════════════════════════════════════════════╝
import pg from 'pg';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const DB_PASS = '49618553Bmb328873%21%21';
const REF     = 'kiubkipfzpnsnntjkxes';
const DB_URL  = `postgresql://postgres.${REF}:${DB_PASS}@aws-1-us-east-2.pooler.supabase.com:5432/postgres`;
const PREFIX  = process.argv[2] ?? '+598';

async function main() {
  console.log(`\n📞  Fix phone country codes — prefijo: ${PREFIX}\n`);

  const client = new pg.Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    process.stdout.write('  Conectando a Supabase... ');
    await client.connect();
    console.log('OK\n');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }

  // ── Preview ──────────────────────────────────────────────
  const { rows } = await client.query(`
    SELECT id, whatsapp_phone AS actual, $1 || whatsapp_phone AS resultado
    FROM public.profiles
    WHERE whatsapp_phone IS NOT NULL
      AND whatsapp_phone <> ''
      AND whatsapp_phone NOT LIKE '+%'
    ORDER BY created_at
  `, [PREFIX]);

  if (rows.length === 0) {
    console.log('✅  No hay números sin código de país. Nada que hacer.');
    await client.end();
    return;
  }

  console.log(`  Se encontraron ${rows.length} número(s) a corregir:\n`);
  console.log('  ID'.padEnd(40) + 'Actual'.padEnd(20) + 'Resultado');
  console.log('  ' + '─'.repeat(70));
  for (const r of rows) {
    console.log(`  ${r.id.padEnd(38)}  ${String(r.actual).padEnd(18)}  ${r.resultado}`);
  }

  // ── Confirmación ─────────────────────────────────────────
  console.log();
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question('  ¿Aplicar cambios? [s/N] ');
  rl.close();

  if (answer.toLowerCase() !== 's') {
    console.log('\n  Cancelado. No se modificó nada.\n');
    await client.end();
    return;
  }

  // ── Update ───────────────────────────────────────────────
  const { rowCount } = await client.query(`
    UPDATE public.profiles
    SET whatsapp_phone = $1 || whatsapp_phone
    WHERE whatsapp_phone IS NOT NULL
      AND whatsapp_phone <> ''
      AND whatsapp_phone NOT LIKE '+%'
  `, [PREFIX]);

  console.log(`\n✅  ${rowCount} número(s) actualizados correctamente.\n`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
