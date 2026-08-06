CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.invoke_email_dispatch_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
   WHERE name = 'email_dispatch_url'
   LIMIT 1;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'email_dispatch_secret'
   LIMIT 1;

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL OR btrim(v_secret) = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := btrim(v_url),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || btrim(v_secret)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN;
END
$function$;

REVOKE ALL ON FUNCTION public.invoke_email_dispatch_scheduler() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_email_dispatch_scheduler() FROM anon;
REVOKE ALL ON FUNCTION public.invoke_email_dispatch_scheduler() FROM authenticated;