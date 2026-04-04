// ╔═══════════════════════════════════════════════════════════╗
// ║  Flowmind – Complete Database Setup                       ║
// ║  Creates tables, RLS, triggers, categories, admin user    ║
// ╚═══════════════════════════════════════════════════════════╝
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SB_URL  = 'https://kiubkipfzpnsnntjkxes.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdWJraXBmenBuc25udGpreGVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NTE3OCwiZXhwIjoyMDkwODUxMTc4fQ.F9c9JmLlBXHl4KdP-SXYVHHEZUFET9-UjGiX86TkbFs';

const hdrs = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
};

// ─── Helper: run raw SQL via pg-meta (same endpoint the Dashboard uses) ───
async function pgQuery(sql, label) {
  const r = await fetch(`${SB_URL}/pg-meta/default/query`, {
    method: 'POST',
    headers: { ...hdrs, 'X-Connection-Encrypted': 'true' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (r.ok) {
    console.log(`  ✔ ${label}`);
    return { ok: true, data: text };
  } else {
    console.log(`  ✘ ${label}: ${r.status} ${text.substring(0, 200)}`);
    return { ok: false, error: text };
  }
}

// ═════════════════════════════════════════════════════════════
// STEP 1 – Create admin user via Auth Admin API
// ═════════════════════════════════════════════════════════════
async function createAdminUser() {
  console.log('\n╔══ STEP 1: Create admin user ══╗');
  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({
      email: 'jgomez@flowmind.app',
      password: 'Flowmind2026!',
      email_confirm: true,
      user_metadata: { display_name: 'J. Gomez', role: 'admin' },
    }),
  });
  const data = await r.json();
  if (r.ok) {
    console.log(`  ✔ User created: ${data.email} (${data.id})`);
    return data.id;
  }
  if (JSON.stringify(data).includes('already')) {
    console.log('  ⚠ Already exists, fetching list…');
    const lr = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers: hdrs });
    const ld = await lr.json();
    const users = ld.users || ld;
    const u = users.find(u => u.email === 'jgomez@flowmind.app');
    if (u) { console.log(`  ✔ Found: ${u.id}`); return u.id; }
  }
  console.log(`  ✘ Error: ${JSON.stringify(data).substring(0, 300)}`);
  return null;
}

// ═════════════════════════════════════════════════════════════
// STEP 2 – Execute migration SQL (schema + seed categories)
// ═════════════════════════════════════════════════════════════
async function runMigrations() {
  console.log('\n╔══ STEP 2: Run migrations ══╗');

  // Break the migration into smaller atomic blocks so any
  // partial failure is easier to diagnose.

  const blocks = [];

  // ── 2a. Extensions ──
  blocks.push({
    label: 'Extensions (uuid-ossp, pgcrypto)',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `,
  });

  // ── 2b. Shared functions ──
  blocks.push({
    label: 'Function: update_updated_at()',
    sql: `
      CREATE OR REPLACE FUNCTION public.update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `,
  });

  blocks.push({
    label: 'Function: handle_new_user()',
    sql: `
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.profiles (id) VALUES (NEW.id);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `,
  });

  // ── 2c. Profiles ──
  blocks.push({
    label: 'Table: profiles',
    sql: `
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        display_name TEXT,
        currency_default TEXT NOT NULL DEFAULT 'UYU'
          CHECK (currency_default IN ('UYU','ARS','USD','EUR','BRL','MXN','CLP','COP','PEN')),
        timezone TEXT NOT NULL DEFAULT 'America/Montevideo',
        plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
        settings_json JSONB NOT NULL DEFAULT '{"alert_low_balance":1000,"alert_forecast_negative":true,"daily_summary":false,"private_mode":false}'::jsonb,
        onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
        ai_usage_count INTEGER NOT NULL DEFAULT 0,
        ai_usage_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  });

  blocks.push({
    label: 'Trigger: on_auth_user_created',
    sql: `
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `,
  });

  blocks.push({
    label: 'Trigger + RLS: profiles',
    sql: `
      DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
      CREATE TRIGGER profiles_updated_at
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can view own profile') THEN
          CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can update own profile') THEN
          CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
        END IF;
      END $$;
    `,
  });

  // ── 2d. Accounts ──
  blocks.push({
    label: 'Table: accounts',
    sql: `
      CREATE TABLE IF NOT EXISTS public.accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'cash' CHECK (type IN ('cash','bank','wallet','credit_card','savings')),
        currency TEXT NOT NULL DEFAULT 'UYU',
        initial_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
        current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        icon TEXT DEFAULT 'wallet',
        color TEXT DEFAULT '#4CAF50',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
      DROP TRIGGER IF EXISTS accounts_updated_at ON public.accounts;
      CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
      ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='Users can view own accounts') THEN
          CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='Users can insert own accounts') THEN
          CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='Users can update own accounts') THEN
          CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='Users can delete own accounts') THEN
          CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  });

  // ── 2e. Categories ──
  blocks.push({
    label: 'Table: categories',
    sql: `
      CREATE TABLE IF NOT EXISTS public.categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('expense','income')),
        icon TEXT NOT NULL DEFAULT 'category',
        color TEXT NOT NULL DEFAULT '#9E9E9E',
        ml_keywords TEXT[] DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
      ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can view own and global categories') THEN
          CREATE POLICY "Users can view own and global categories" ON public.categories FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can insert own categories') THEN
          CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can update own categories') THEN
          CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can delete own categories') THEN
          CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  });

  // ── 2f. Transactions ──
  blocks.push({
    label: 'Table: transactions',
    sql: `
      CREATE TABLE IF NOT EXISTS public.transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('expense','income','transfer')),
        amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
        currency TEXT NOT NULL DEFAULT 'UYU',
        date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        merchant TEXT,
        category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
        notes TEXT,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','text','voice','receipt')),
        confidence NUMERIC(3,2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
        raw_payload_json JSONB,
        is_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
        is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
        transfer_to_account_id UUID REFERENCES public.accounts(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id    ON public.transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date       ON public.transactions(date DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_category   ON public.transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_date  ON public.transactions(user_id, date DESC);
      DROP TRIGGER IF EXISTS transactions_updated_at ON public.transactions;
      CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
      ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='Users can view own transactions') THEN
          CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='Users can insert own transactions') THEN
          CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='Users can update own transactions') THEN
          CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='Users can delete own transactions') THEN
          CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  });

  // ── 2g. Receipts ──
  blocks.push({
    label: 'Table: receipts',
    sql: `
      CREATE TABLE IF NOT EXISTS public.receipts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
        image_path TEXT NOT NULL,
        ocr_text TEXT,
        vendor_guess TEXT,
        total_guess NUMERIC(15,2),
        date_guess TIMESTAMPTZ,
        raw_ocr_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_transaction_id ON public.receipts(transaction_id);
      ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='receipts' AND policyname='Users can view own receipts tbl') THEN
          CREATE POLICY "Users can view own receipts tbl" ON public.receipts FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='receipts' AND policyname='Users can insert own receipts tbl') THEN
          CREATE POLICY "Users can insert own receipts tbl" ON public.receipts FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='receipts' AND policyname='Users can update own receipts tbl') THEN
          CREATE POLICY "Users can update own receipts tbl" ON public.receipts FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='receipts' AND policyname='Users can delete own receipts tbl') THEN
          CREATE POLICY "Users can delete own receipts tbl" ON public.receipts FOR DELETE USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  });

  // ── 2h. Budgets ──
  blocks.push({
    label: 'Table: budgets',
    sql: `
      CREATE TABLE IF NOT EXISTS public.budgets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
        period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly','monthly')),
        limit_amount NUMERIC(15,2) NOT NULL CHECK (limit_amount > 0),
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
      DROP TRIGGER IF EXISTS budgets_updated_at ON public.budgets;
      CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
      ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='budgets' AND policyname='Users can view own budgets') THEN
          CREATE POLICY "Users can view own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='budgets' AND policyname='Users can insert own budgets') THEN
          CREATE POLICY "Users can insert own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='budgets' AND policyname='Users can update own budgets') THEN
          CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='budgets' AND policyname='Users can delete own budgets') THEN
          CREATE POLICY "Users can delete own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  });

  // ── 2i. Alerts ──
  blocks.push({
    label: 'Table: alerts',
    sql: `
      CREATE TABLE IF NOT EXISTS public.alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('low_balance','budget_near_limit','budget_exceeded','forecast_negative','anomaly','custom')),
        threshold_json JSONB NOT NULL DEFAULT '{}',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_triggered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
      DROP TRIGGER IF EXISTS alerts_updated_at ON public.alerts;
      CREATE TRIGGER alerts_updated_at BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
      ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='Users can view own alerts') THEN
          CREATE POLICY "Users can view own alerts" ON public.alerts FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='Users can insert own alerts') THEN
          CREATE POLICY "Users can insert own alerts" ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='Users can update own alerts') THEN
          CREATE POLICY "Users can update own alerts" ON public.alerts FOR UPDATE USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='Users can delete own alerts') THEN
          CREATE POLICY "Users can delete own alerts" ON public.alerts FOR DELETE USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  });

  // ── 2j. AI Insights ──
  blocks.push({
    label: 'Table: ai_insights',
    sql: `
      CREATE TABLE IF NOT EXISTS public.ai_insights (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('spend_change','anomaly','suggestion','forecast','summary','trend')),
        title TEXT NOT NULL,
        detail TEXT,
        severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
        payload_json JSONB DEFAULT '{}',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON public.ai_insights(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_insights_period ON public.ai_insights(user_id, period_start DESC);
      ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Users can view own insights') THEN
          CREATE POLICY "Users can view own insights" ON public.ai_insights FOR SELECT USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Service can insert insights') THEN
          CREATE POLICY "Service can insert insights" ON public.ai_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Users can update own insights') THEN
          CREATE POLICY "Users can update own insights" ON public.ai_insights FOR UPDATE USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  });

  // ── 2k. Subscriptions ──
  blocks.push({
    label: 'Table: subscriptions',
    sql: `
      CREATE TABLE IF NOT EXISTS public.subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
        product_id TEXT NOT NULL,
        purchase_token TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired','grace_period')),
        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        receipt_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
      DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
      CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
      ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='Users can view own subscriptions') THEN
          CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  });

  // ── 2l. Analytics events ──
  blocks.push({
    label: 'Table: analytics_events',
    sql: `
      CREATE TABLE IF NOT EXISTS public.analytics_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        event_name TEXT NOT NULL,
        event_data JSONB DEFAULT '{}',
        device_info JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON public.analytics_events(event_name);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON public.analytics_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_date ON public.analytics_events(created_at DESC);
      ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analytics_events' AND policyname='Users can insert own events') THEN
          CREATE POLICY "Users can insert own events" ON public.analytics_events FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  });

  // ── 2m. Seed global categories ──
  blocks.push({
    label: 'Seed: global categories',
    sql: `
      INSERT INTO public.categories (id, user_id, name, type, icon, color, ml_keywords, sort_order)
      SELECT * FROM (VALUES
        (uuid_generate_v4(), NULL::UUID, 'Supermercado', 'expense', 'shopping_cart', '#4CAF50', ARRAY['super','mercado','almacen','tienda'], 1),
        (uuid_generate_v4(), NULL::UUID, 'Restaurante', 'expense', 'restaurant', '#FF9800', ARRAY['restaurant','comida','almuerzo','cena','cafe','bar'], 2),
        (uuid_generate_v4(), NULL::UUID, 'Transporte', 'expense', 'directions_car', '#2196F3', ARRAY['uber','taxi','nafta','combustible','estacionamiento','bus','peaje'], 3),
        (uuid_generate_v4(), NULL::UUID, 'Salud', 'expense', 'local_hospital', '#F44336', ARRAY['farmacia','medico','doctor','hospital','clinica','mutualista'], 4),
        (uuid_generate_v4(), NULL::UUID, 'Entretenimiento', 'expense', 'movie', '#9C27B0', ARRAY['cine','netflix','spotify','juego','streaming'], 5),
        (uuid_generate_v4(), NULL::UUID, 'Hogar', 'expense', 'home', '#795548', ARRAY['alquiler','ute','ose','antel','luz','agua','gas','internet'], 6),
        (uuid_generate_v4(), NULL::UUID, 'Ropa', 'expense', 'checkroom', '#E91E63', ARRAY['ropa','zapatos','zapatillas','vestimenta'], 7),
        (uuid_generate_v4(), NULL::UUID, 'Educación', 'expense', 'school', '#3F51B5', ARRAY['curso','libro','universidad','colegio','academia'], 8),
        (uuid_generate_v4(), NULL::UUID, 'Otros gastos', 'expense', 'more_horiz', '#607D8B', ARRAY[]::TEXT[], 99),
        (uuid_generate_v4(), NULL::UUID, 'Salario', 'income', 'payments', '#4CAF50', ARRAY['sueldo','salario','nomina','quincena'], 1),
        (uuid_generate_v4(), NULL::UUID, 'Freelance', 'income', 'work', '#FF9800', ARRAY['freelance','proyecto','trabajo','honorarios'], 2),
        (uuid_generate_v4(), NULL::UUID, 'Ventas', 'income', 'storefront', '#2196F3', ARRAY['venta','vendi'], 3),
        (uuid_generate_v4(), NULL::UUID, 'Otros ingresos', 'income', 'add_circle', '#607D8B', ARRAY[]::TEXT[], 99)
      ) AS t(id, user_id, name, type, icon, color, ml_keywords, sort_order)
      WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id IS NULL LIMIT 1);
    `,
  });

  // ── 2n. Balance trigger ──
  blocks.push({
    label: 'Function + Trigger: update_account_balance',
    sql: `
      CREATE OR REPLACE FUNCTION public.update_account_balance()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW.type = 'expense' THEN
            UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
          ELSIF NEW.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
          ELSIF NEW.type = 'transfer' AND NEW.transfer_to_account_id IS NOT NULL THEN
            UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
            UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.transfer_to_account_id;
          END IF;
        ELSIF TG_OP = 'DELETE' THEN
          IF OLD.type = 'expense' THEN
            UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
          ELSIF OLD.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
          ELSIF OLD.type = 'transfer' AND OLD.transfer_to_account_id IS NOT NULL THEN
            UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
            UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.transfer_to_account_id;
          END IF;
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS update_balance_on_transaction ON public.transactions;
      CREATE TRIGGER update_balance_on_transaction
        AFTER INSERT OR DELETE ON public.transactions
        FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();
    `,
  });

  // ── 2o. Monthly summary function ──
  blocks.push({
    label: 'Function: get_monthly_summary',
    sql: `
      CREATE OR REPLACE FUNCTION public.get_monthly_summary(
        p_user_id UUID, p_year INTEGER, p_month INTEGER
      )
      RETURNS TABLE (
        total_income NUMERIC, total_expenses NUMERIC, net NUMERIC,
        transaction_count BIGINT, top_category TEXT, top_category_amount NUMERIC
      ) AS $$
      BEGIN
        RETURN QUERY
        WITH period AS (
          SELECT
            COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS inc,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS exp,
            COUNT(*) AS cnt
          FROM public.transactions
          WHERE user_id = p_user_id
            AND EXTRACT(YEAR FROM date) = p_year
            AND EXTRACT(MONTH FROM date) = p_month
        ),
        top_cat AS (
          SELECT c.name, SUM(t.amount) AS cat_total
          FROM public.transactions t
          LEFT JOIN public.categories c ON t.category_id = c.id
          WHERE t.user_id = p_user_id AND t.type='expense'
            AND EXTRACT(YEAR FROM t.date) = p_year
            AND EXTRACT(MONTH FROM t.date) = p_month
          GROUP BY c.name ORDER BY cat_total DESC LIMIT 1
        )
        SELECT p.inc, p.exp, p.inc - p.exp, p.cnt,
               COALESCE(tc.name,'Sin categoría'), COALESCE(tc.cat_total,0)
        FROM period p LEFT JOIN top_cat tc ON TRUE;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `,
  });

  // ── 2p. Storage buckets ──
  blocks.push({
    label: 'Storage: receipts bucket',
    sql: `
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('receipts','receipts',FALSE,10485760,ARRAY['image/jpeg','image/png','image/webp','image/heic'])
      ON CONFLICT (id) DO NOTHING;
    `,
  });

  blocks.push({
    label: 'Storage: audio bucket',
    sql: `
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('audio','audio',FALSE,5242880,ARRAY['audio/wav','audio/mp3','audio/m4a','audio/webm','audio/ogg'])
      ON CONFLICT (id) DO NOTHING;
    `,
  });

  blocks.push({
    label: 'Storage RLS: receipts policies',
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Upload own receipts') THEN
          CREATE POLICY "Upload own receipts" ON storage.objects FOR INSERT
            WITH CHECK (bucket_id='receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='View own receipts') THEN
          CREATE POLICY "View own receipts" ON storage.objects FOR SELECT
            USING (bucket_id='receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Delete own receipts') THEN
          CREATE POLICY "Delete own receipts" ON storage.objects FOR DELETE
            USING (bucket_id='receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
        END IF;
      END $$;
    `,
  });

  blocks.push({
    label: 'Storage RLS: audio policies',
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Upload own audio') THEN
          CREATE POLICY "Upload own audio" ON storage.objects FOR INSERT
            WITH CHECK (bucket_id='audio' AND auth.uid()::text = (storage.foldername(name))[1]);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='View own audio') THEN
          CREATE POLICY "View own audio" ON storage.objects FOR SELECT
            USING (bucket_id='audio' AND auth.uid()::text = (storage.foldername(name))[1]);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Delete own audio') THEN
          CREATE POLICY "Delete own audio" ON storage.objects FOR DELETE
            USING (bucket_id='audio' AND auth.uid()::text = (storage.foldername(name))[1]);
        END IF;
      END $$;
    `,
  });

  // Run each block sequentially
  let ok = 0, fail = 0;
  for (const b of blocks) {
    const result = await pgQuery(b.sql, b.label);
    if (result.ok) ok++; else fail++;
  }

  console.log(`\n  Summary: ${ok} succeeded, ${fail} failed out of ${blocks.length}`);
  return fail === 0;
}

// ═════════════════════════════════════════════════════════════
// STEP 3 – Set admin profile to PRO plan
// ═════════════════════════════════════════════════════════════
async function setAdminPro(userId) {
  console.log('\n╔══ STEP 3: Set admin profile → pro ══╗');

  // The trigger on auth.users will auto-create the profile
  // Now update it to pro + display_name
  await pgQuery(`
    UPDATE public.profiles
    SET plan = 'pro',
        display_name = 'J. Gomez',
        onboarding_completed = true
    WHERE id = '${userId}';
  `, 'Profile → pro plan');

  // Also create a default "Efectivo" account for the admin user
  await pgQuery(`
    INSERT INTO public.accounts (user_id, name, type, currency, initial_balance, current_balance, is_primary, icon, color)
    VALUES ('${userId}', 'Efectivo', 'cash', 'UYU', 0, 0, true, 'wallet', '#4CAF50')
    ON CONFLICT DO NOTHING;
  `, 'Default account: Efectivo');
}

// ═════════════════════════════════════════════════════════════
// STEP 4 – Verify everything
// ═════════════════════════════════════════════════════════════
async function verify() {
  console.log('\n╔══ STEP 4: Verification ══╗');
  const tables = ['profiles','accounts','categories','transactions','receipts','budgets','alerts','ai_insights','subscriptions','analytics_events'];

  for (const t of tables) {
    const r = await fetch(`${SB_URL}/rest/v1/${t}?select=id&limit=1`, { headers });
    const status = r.ok ? '✔' : '✘';
    const count = r.ok ? (await r.json()).length : r.status;
    console.log(`  ${status} ${t.padEnd(20)} ${r.ok ? `(${count} rows sample)` : `HTTP ${count}`}`);
  }

  // Check categories count
  const cr = await fetch(`${SB_URL}/rest/v1/categories?select=id&user_id=is.null`, { headers });
  if (cr.ok) {
    const cats = await cr.json();
    console.log(`  ✔ Global categories: ${cats.length}`);
  }

  // Check storage buckets
  const sr = await fetch(`${SB_URL}/storage/v1/bucket`, { headers });
  if (sr.ok) {
    const buckets = await sr.json();
    console.log(`  ✔ Storage buckets: ${buckets.map(b => b.name).join(', ')}`);
  }

  // Check admin user profile
  const pr = await fetch(`${SB_URL}/rest/v1/profiles?select=id,display_name,plan,onboarding_completed&limit=5`, { headers });
  if (pr.ok) {
    const profiles = await pr.json();
    console.log(`  ✔ Profiles: ${JSON.stringify(profiles)}`);
  }
}

// ═════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════
async function main() {
  console.log('🚀 Flowmind Database Setup\n');

  // Step 1: Create admin user
  const userId = await createAdminUser();

  // Step 2: Run migrations
  const success = await runMigrations();

  // Step 3: Set admin profile
  if (userId) {
    await setAdminPro(userId);
  }

  // Step 4: Verify
  await verify();

  console.log('\n═══════════════════════════════════════');
  if (userId) {
    console.log('📧 Admin Login:');
    console.log('   Email:    jgomez@flowmind.app');
    console.log('   Password: Flowmind2026!');
  }
  console.log('═══════════════════════════════════════');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
