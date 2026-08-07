-- Corrective checkpoint, part 2 of 2.
--
-- Authoritative final provider-attempt fence. The application already performs a
-- Plan-consent boundary read before rendering, but that read can go stale: a
-- Plan unsubscribe, a Recovery re-consent, or an authoritative cancellation can
-- land after it. This function moves the decision into the LAST fenced database
-- write immediately before any provider call, so all three facts are verified
-- atomically under one row lock:
--
--   1. current job lease / processing ownership (claim token fencing)
--   2. Plan-email consent currently active           (proactive jobs only)
--   3. job.created_at >= current plan_email_consent_at (proactive jobs only)
--
-- Recovery is transactional on-demand product access and stays outside
-- Plan-consent gating; hard-bounce / complaint suppression is enforced
-- separately and absolutely by the dispatcher before this point.
--
-- Provider idempotency is preserved: the first-provider-attempt boundary is only
-- ever filled when empty, so it stays immutable across provider retries and the
-- existing lost-lease behavior is unchanged ('lost_lease' is returned exactly
-- where the previous fenced update matched no row).
CREATE OR REPLACE FUNCTION public.begin_provider_attempt(
  p_job_id uuid,
  p_claim_token uuid,
  p_attempted_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job public.email_jobs;
  v_consent_active boolean;
  v_consent_at timestamptz;
BEGIN
  IF p_job_id IS NULL OR p_claim_token IS NULL THEN
    RETURN 'lost_lease';
  END IF;

  SELECT * INTO v_job
    FROM public.email_jobs
   WHERE job_id = p_job_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'lost_lease';
  END IF;

  -- Lease ownership: only the current claim holder of a processing job may
  -- attempt a provider send.
  IF v_job.status <> 'processing'
     OR v_job.claim_token IS NULL
     OR v_job.claim_token <> p_claim_token THEN
    RETURN 'lost_lease';
  END IF;

  IF v_job.job_type IN ('plan_ready','start_day_1','halfway','stalled','final_rescue','plan_completed') THEN
    SELECT plan_email_consent_active, plan_email_consent_at
      INTO v_consent_active, v_consent_at
      FROM public.lead_plans
     WHERE id = v_job.lead_plan_id
     FOR SHARE;

    IF NOT FOUND OR NOT COALESCE(v_consent_active, false) THEN
      RETURN 'consent_blocked';
    END IF;

    IF v_consent_at IS NOT NULL AND v_job.created_at < v_consent_at THEN
      RETURN 'consent_blocked';
    END IF;
  END IF;

  -- Fenced compare-and-set that only ever fills an empty boundary.
  UPDATE public.email_jobs
     SET first_provider_attempt_at = COALESCE(first_provider_attempt_at, p_attempted_at),
         updated_at = now()
   WHERE job_id = p_job_id
     AND claim_token = p_claim_token
     AND status = 'processing';

  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.begin_provider_attempt(uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_provider_attempt(uuid, uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.begin_provider_attempt(uuid, uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.begin_provider_attempt(uuid, uuid, timestamptz) TO service_role;