-- Auto-cleanup for whatsapp_pending: delete expired rows
-- Runs as a scheduled job (pg_cron) or can be called manually

CREATE OR REPLACE FUNCTION public.cleanup_whatsapp_pending()
RETURNS void AS $$
BEGIN
  DELETE FROM public.whatsapp_pending
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup every 15 minutes using pg_cron (enable in Supabase Dashboard → Extensions)
-- If pg_cron is not available, this SELECT is a no-op and cleanup runs on next webhook call
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-whatsapp-pending',
      '*/15 * * * *',
      'SELECT public.cleanup_whatsapp_pending()'
    );
  END IF;
END;
$$;
