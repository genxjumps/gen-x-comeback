-- Recovery email is transactional. It must remain claimable and sendable when
-- proactive 7-Day Plan email consent is inactive. Marketing consent is separate
-- and is not consulted by the production email job pipeline.
--
-- Proactive lifecycle jobs retain the existing Plan-email consent fence at both
-- claim time and immediately before provider submission. Hard-bounce/complaint
-- suppression, production activation, controlled scope, authentication, and
-- rolling provider-volume limits continue to apply to recovery.

CREATE OR REPLACE FUNCTION public.claim_production_email_jobs(
  p_job_type text,
  p_invocation_id uuid,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_control public.email_production_control;
  v_remaining integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.email_scheduler_invocations i
     WHERE i.invocation_id = p_invocation_id
       AND i.authenticated_at IS NOT NULL
       AND i.completed_at IS NULL
  ) THEN RETURN; END IF;

  SELECT * INTO v_control FROM public.email_production_control
   WHERE singleton_id = 1;
  IF NOT COALESCE(v_control.sending_enabled, false)
     OR v_control.activation_boundary IS NULL THEN RETURN; END IF;

  SELECT v_control.provider_submission_limit - count(*) INTO v_remaining
    FROM public.email_provider_submissions
   WHERE reserved_at >= now() - interval '24 hours'
     AND status IN ('reserved', 'accepted', 'uncertain');
  IF v_remaining <= 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH due AS (
    SELECT j.job_id
      FROM public.email_jobs j
      JOIN public.lead_plans l ON l.id = j.lead_plan_id
     WHERE j.job_type = p_job_type
       AND j.status IN ('pending', 'retry_scheduled', 'processing')
       AND j.created_at >= v_control.activation_boundary
       AND j.eligible_at <= now()
       AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= now())
       AND (j.status <> 'processing' OR j.lease_expires_at IS NULL OR j.lease_expires_at <= now())
       AND (
         j.job_type = 'recovery'
         OR (
           l.plan_email_consent_active = true
           AND l.plan_email_consent_at IS NOT NULL
           AND j.created_at >= l.plan_email_consent_at
         )
       )
       AND l.email_suppressed_at IS NULL
       AND l.email_suppression_reason IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions s
          WHERE s.email_normalized = l.email_normalized
            AND s.reason IN ('hard_bounce', 'complaint')
       )
       AND (
         v_control.genuine_plans_admitted
         OR j.lead_plan_id = v_control.controlled_lead_plan_id
       )
     ORDER BY COALESCE(j.next_attempt_at, j.eligible_at), j.created_at, j.job_id
     FOR UPDATE OF j SKIP LOCKED
     LIMIT LEAST(GREATEST(p_limit, 0), v_remaining)
  )
  UPDATE public.email_jobs j
     SET status = 'processing',
         attempt_count = j.attempt_count + 1,
         locked_at = now(),
         lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
         claim_token = gen_random_uuid(),
         updated_at = now()
    FROM due
   WHERE j.job_id = due.job_id
  RETURNING j.*;
END $function$;

CREATE OR REPLACE FUNCTION public.begin_production_provider_attempt(
  p_job_id uuid,
  p_claim_token uuid,
  p_invocation_id uuid,
  p_attempted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.email_jobs;
  v_lead public.lead_plans;
  v_control public.email_production_control;
  v_invocation public.email_scheduler_invocations;
  v_count integer;
  v_attempt_id uuid;
BEGIN
  IF p_job_id IS NULL OR p_claim_token IS NULL OR p_invocation_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'lost_lease');
  END IF;

  SELECT * INTO v_job FROM public.email_jobs
   WHERE job_id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status <> 'processing'
     OR v_job.claim_token IS NULL OR v_job.claim_token <> p_claim_token THEN
    RETURN jsonb_build_object('outcome', 'lost_lease');
  END IF;

  SELECT * INTO v_invocation FROM public.email_scheduler_invocations
   WHERE invocation_id = p_invocation_id FOR SHARE;
  IF NOT FOUND OR v_invocation.authenticated_at IS NULL
     OR v_invocation.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'authentication_blocked');
  END IF;

  SELECT * INTO v_control FROM public.email_production_control
   WHERE singleton_id = 1 FOR UPDATE;
  IF NOT COALESCE(v_control.sending_enabled, false) THEN
    RETURN jsonb_build_object('outcome', 'sending_disabled');
  END IF;
  IF v_control.activation_boundary IS NULL
     OR v_job.created_at < v_control.activation_boundary THEN
    RETURN jsonb_build_object('outcome', 'activation_blocked');
  END IF;
  IF NOT v_control.genuine_plans_admitted
     AND (v_control.controlled_lead_plan_id IS NULL
       OR v_job.lead_plan_id <> v_control.controlled_lead_plan_id) THEN
    RETURN jsonb_build_object('outcome', 'controlled_scope_blocked');
  END IF;

  SELECT * INTO v_lead FROM public.lead_plans
   WHERE id = v_job.lead_plan_id FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'consent_blocked');
  END IF;
  IF v_job.job_type <> 'recovery'
     AND (NOT COALESCE(v_lead.plan_email_consent_active, false)
       OR v_lead.plan_email_consent_at IS NULL
       OR v_job.created_at < v_lead.plan_email_consent_at) THEN
    RETURN jsonb_build_object('outcome', 'consent_blocked');
  END IF;
  IF v_lead.email_suppressed_at IS NOT NULL
     OR v_lead.email_suppression_reason IN ('hard_bounce', 'complaint')
     OR EXISTS (
       SELECT 1 FROM public.email_suppressions s
        WHERE s.email_normalized = v_lead.email_normalized
          AND s.reason IN ('hard_bounce', 'complaint')
     ) THEN
    RETURN jsonb_build_object('outcome', 'suppression_blocked');
  END IF;

  SELECT count(*) INTO v_count
    FROM public.email_provider_submissions
   WHERE reserved_at >= p_attempted_at - interval '24 hours'
     AND status IN ('reserved', 'accepted', 'uncertain');
  IF v_count >= v_control.provider_submission_limit THEN
    RETURN jsonb_build_object('outcome', 'limit_reached');
  END IF;

  INSERT INTO public.email_provider_submissions (
    invocation_id, job_id, lead_plan_id, job_type, template_version,
    idempotency_key, reserved_at
  ) VALUES (
    p_invocation_id, v_job.job_id, v_job.lead_plan_id, v_job.job_type,
    v_job.template_version, v_job.idempotency_key, p_attempted_at
  ) RETURNING submission_attempt_id INTO v_attempt_id;

  UPDATE public.email_jobs
     SET first_provider_attempt_at = COALESCE(first_provider_attempt_at, p_attempted_at),
         updated_at = now()
   WHERE job_id = p_job_id AND claim_token = p_claim_token AND status = 'processing';

  RETURN jsonb_build_object('outcome', 'ok', 'submission_attempt_id', v_attempt_id);
END $function$;

REVOKE ALL ON FUNCTION public.claim_production_email_jobs(text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_production_email_jobs(text, uuid, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.begin_production_provider_attempt(uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_production_provider_attempt(uuid, uuid, uuid, timestamptz) TO service_role;
