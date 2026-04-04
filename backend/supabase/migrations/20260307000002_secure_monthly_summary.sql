-- Secure get_monthly_summary: bind p_user_id to auth.uid() so it cannot
-- be called with an arbitrary user_id via RPC.

CREATE OR REPLACE FUNCTION public.get_monthly_summary(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  total_income NUMERIC,
  total_expenses NUMERIC,
  net NUMERIC,
  transaction_count BIGINT,
  top_category TEXT,
  top_category_amount NUMERIC
) AS $$
BEGIN
  -- Enforce that callers can only query their own data
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'permission denied: cannot query another user''s summary';
  END IF;

  RETURN QUERY
  WITH period AS (
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS inc,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS exp,
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
    WHERE t.user_id = p_user_id
      AND t.type = 'expense'
      AND EXTRACT(YEAR FROM t.date) = p_year
      AND EXTRACT(MONTH FROM t.date) = p_month
    GROUP BY c.name
    ORDER BY cat_total DESC
    LIMIT 1
  )
  SELECT
    p.inc,
    p.exp,
    p.inc - p.exp,
    p.cnt,
    COALESCE(tc.name, 'Sin categoría'),
    COALESCE(tc.cat_total, 0)
  FROM period p
  LEFT JOIN top_cat tc ON TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
