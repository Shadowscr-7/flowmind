-- ============================================================
-- Flowmind – Schema Patch
-- Ejecutar en: https://supabase.com/dashboard/project/kiubkipfzpnsnntjkxes/sql/new
-- Es seguro correr múltiples veces (idempotente)
-- ============================================================

-- ── 1. Renombrar columnas inconsistentes ───────────────────────────────────────
-- accounts: current_balance → balance (así lo espera la web app)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'current_balance'
  ) THEN
    ALTER TABLE public.accounts RENAME COLUMN current_balance TO balance;
  END IF;
END $$;

-- budgets: limit_amount → amount
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'budgets' AND column_name = 'limit_amount'
  ) THEN
    ALTER TABLE public.budgets RENAME COLUMN limit_amount TO amount;
  END IF;
END $$;

-- ── 2. Agregar columnas faltantes ──────────────────────────────────────────────
-- profiles.whatsapp_phone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT DEFAULT NULL;

-- ── 3. Ampliar CHECK de transactions.source para WhatsApp ──────────────────────
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual','text','voice','receipt','whatsapp','whatsapp_text','whatsapp_voice','whatsapp_image'));

-- ── 4. Reparar trigger de balance (usa nombre nuevo "balance") ─────────────────
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'expense' THEN
      UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'income' THEN
      UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transfer' AND NEW.transfer_to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.transfer_to_account_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'expense' THEN
      UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'income' THEN
      UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transfer' AND OLD.transfer_to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.transfer_to_account_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_balance_on_transaction ON public.transactions;
CREATE TRIGGER update_balance_on_transaction
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();

-- ── 5. Semilla de categorías globales (si no existen) ─────────────────────────
INSERT INTO public.categories (id, user_id, name, type, icon, color, ml_keywords, sort_order)
SELECT * FROM (VALUES
  (uuid_generate_v4(), NULL::UUID, 'Supermercado',    'expense', 'shopping_cart',  '#4CAF50', ARRAY['super','mercado','almacen','tienda'],                         1),
  (uuid_generate_v4(), NULL::UUID, 'Restaurante',     'expense', 'restaurant',     '#FF9800', ARRAY['restaurant','comida','almuerzo','cena','cafe','bar'],          2),
  (uuid_generate_v4(), NULL::UUID, 'Transporte',      'expense', 'directions_car', '#2196F3', ARRAY['uber','taxi','nafta','combustible','estacionamiento','bus'],   3),
  (uuid_generate_v4(), NULL::UUID, 'Salud',           'expense', 'local_hospital', '#F44336', ARRAY['farmacia','medico','doctor','hospital','clinica'],             4),
  (uuid_generate_v4(), NULL::UUID, 'Entretenimiento', 'expense', 'movie',          '#9C27B0', ARRAY['cine','netflix','spotify','juego','streaming'],                5),
  (uuid_generate_v4(), NULL::UUID, 'Hogar',           'expense', 'home',           '#795548', ARRAY['alquiler','ute','ose','antel','luz','agua','gas','internet'],  6),
  (uuid_generate_v4(), NULL::UUID, 'Ropa',            'expense', 'checkroom',      '#E91E63', ARRAY['ropa','zapatos','zapatillas','vestimenta'],                    7),
  (uuid_generate_v4(), NULL::UUID, 'Educación',       'expense', 'school',         '#3F51B5', ARRAY['curso','libro','universidad','colegio','academia'],            8),
  (uuid_generate_v4(), NULL::UUID, 'Otros gastos',    'expense', 'more_horiz',     '#607D8B', ARRAY[]::TEXT[],                                                     99),
  (uuid_generate_v4(), NULL::UUID, 'Salario',         'income',  'payments',       '#4CAF50', ARRAY['sueldo','salario','nomina','quincena'],                        1),
  (uuid_generate_v4(), NULL::UUID, 'Freelance',       'income',  'work',           '#FF9800', ARRAY['freelance','proyecto','trabajo','honorarios'],                 2),
  (uuid_generate_v4(), NULL::UUID, 'Ventas',          'income',  'storefront',     '#2196F3', ARRAY['venta','vendi'],                                              3),
  (uuid_generate_v4(), NULL::UUID, 'Otros ingresos',  'income',  'add_circle',     '#607D8B', ARRAY[]::TEXT[],                                                     99)
) AS t(id, user_id, name, type, icon, color, ml_keywords, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id IS NULL LIMIT 1);

-- ── 6. Storage buckets ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts','receipts',FALSE,10485760,ARRAY['image/jpeg','image/png','image/webp','image/heic'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audio','audio',FALSE,5242880,ARRAY['audio/wav','audio/mp3','audio/m4a','audio/webm','audio/ogg'])
ON CONFLICT (id) DO NOTHING;

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
