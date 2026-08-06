CREATE OR REPLACE FUNCTION public.claim_email_jobs_for_lead(p_job_type text, p_lead_plan_id uuid, p_limit integer DEFAULT 25, p_lease_seconds integer DEFAULT 120)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF p_lead_plan_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.email_jobs j
     SET status = 'processing',
         attempt_count = j.attempt_count + 1,
         claim_token = gen_random_uuid(),
         locked_at = v_now,
         lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
         updated_at = v_now
   WHERE j.job_id IN (
     SELECT c.job_id FROM public.email_jobs c
      WHERE c.job_type = p_job_type
        AND c.lead_plan_id = p_lead_plan_id
        AND c.status IN ('pending','retry_scheduled','processing')
        AND c.eligible_at <= v_now
        AND (c.next_attempt_at IS NULL OR c.next_attempt_at <= v_now)
        AND (c.status <> 'processing' OR c.lease_expires_at IS NULL OR c.lease_expires_at < v_now)
      ORDER BY c.eligible_at ASC
        FOR UPDATE SKIP LOCKED
      LIMIT p_limit
   )
     AND j.lead_plan_id = p_lead_plan_id
  RETURNING j.*;
END $function$;

REVOKE ALL ON FUNCTION public.claim_email_jobs_for_lead(text, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_email_jobs_for_lead(text, uuid, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_email_jobs_for_lead(text, uuid, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_jobs_for_lead(text, uuid, integer, integer) TO service_role;