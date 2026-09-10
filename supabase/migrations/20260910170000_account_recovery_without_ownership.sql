-- Account recovery establishes identity, never paid ownership.
-- Existing entitlement-bound purchase and legacy recovery credentials keep their fences.
ALTER TABLE public.paid_access_email_jobs ALTER COLUMN entitlement_id DROP NOT NULL;
ALTER TABLE public.paid_access_tokens ALTER COLUMN entitlement_id DROP NOT NULL;
ALTER TABLE public.paid_access_email_jobs ADD CONSTRAINT paid_access_job_scope_check
  CHECK (entitlement_id IS NOT NULL OR job_type = 'paid_recovery');

CREATE OR REPLACE FUNCTION public.enqueue_paid_access_job(
  p_job_type text,
  p_customer_id uuid,
  p_entitlement_id uuid,
  p_idempotency_key text,
  p_eligible_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF p_job_type NOT IN ('paid_purchase_access', 'paid_recovery')
    OR p_customer_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.customer_accounts WHERE id = p_customer_id)
    OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0
    OR NOT (
      (p_job_type = 'paid_recovery' AND p_entitlement_id IS NULL)
      OR EXISTS (
      SELECT 1 FROM public.paid_product_entitlements entitlement
       WHERE entitlement.id = p_entitlement_id
         AND entitlement.customer_id = p_customer_id
         AND entitlement.status = 'active'
      )
    )
  THEN RETURN NULL; END IF;

  INSERT INTO public.paid_access_email_jobs (
    job_type, job_version, template_version, customer_id, entitlement_id,
    idempotency_key, eligible_at, status
  ) VALUES (
    p_job_type, 'v1', 'paid_access_v1', p_customer_id, p_entitlement_id,
    p_idempotency_key, COALESCE(p_eligible_at, now()), 'pending'
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING job_id INTO v_job_id;

  IF v_job_id IS NOT NULL THEN
    INSERT INTO public.paid_access_email_events (
      event_name, job_id, customer_id, entitlement_id
    ) VALUES (
      CASE WHEN p_job_type = 'paid_purchase_access'
        THEN 'paid_purchase_access_queued' ELSE 'paid_recovery_queued' END,
      v_job_id, p_customer_id, p_entitlement_id
    );
  END IF;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_customer_access_recovery(
  p_email_normalized text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  IF p_email_normalized IS NULL
    OR p_email_normalized <> lower(btrim(p_email_normalized))
    OR length(p_email_normalized) NOT BETWEEN 3 AND 254
    OR p_request_id IS NULL OR length(btrim(p_request_id)) = 0
  THEN RETURN; END IF;

  SELECT account.id INTO v_customer_id
    FROM public.customer_accounts account
   WHERE account.email_normalized = p_email_normalized
   LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    PERFORM public.enqueue_paid_access_job(
      'paid_recovery', v_customer_id, NULL,
      'paid_recovery:' || v_customer_id::text || ':' || p_request_id || ':v1', now()
    );
    RETURN;
  END IF;

  PERFORM public.request_plan_recovery(p_email_normalized, p_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_production_paid_access_email_jobs(
  p_job_type text,
  p_invocation_id uuid,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.paid_access_email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control public.email_production_control;
  v_remaining integer;
BEGIN
  IF p_job_type NOT IN ('paid_purchase_access', 'paid_recovery') OR NOT EXISTS (
    SELECT 1 FROM public.email_scheduler_invocations invocation
     WHERE invocation.invocation_id = p_invocation_id
       AND invocation.authenticated_at IS NOT NULL
       AND invocation.completed_at IS NULL
  ) THEN RETURN; END IF;

  SELECT * INTO v_control FROM public.email_production_control WHERE singleton_id = 1;
  IF NOT COALESCE(v_control.sending_enabled, false)
    OR NOT COALESCE(v_control.paid_access_sending_enabled, false)
    OR v_control.activation_boundary IS NULL
  THEN RETURN; END IF;

  SELECT v_control.provider_submission_limit
    - (SELECT count(*) FROM public.email_provider_submissions submission
        WHERE submission.reserved_at >= now() - interval '24 hours'
          AND submission.status IN ('reserved', 'accepted', 'uncertain'))
    INTO v_remaining;
  IF v_remaining <= 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH due AS (
    SELECT job.job_id
      FROM public.paid_access_email_jobs job
      JOIN public.customer_accounts account ON account.id = job.customer_id
      LEFT JOIN public.paid_product_entitlements entitlement
        ON entitlement.id = job.entitlement_id
       AND entitlement.customer_id = job.customer_id
       AND entitlement.status = 'active'
     WHERE ((job.job_type = 'paid_recovery' AND job.entitlement_id IS NULL)
         OR entitlement.id IS NOT NULL)
       AND job.job_type = p_job_type
       AND job.status IN ('pending', 'retry_scheduled', 'processing')
       AND job.created_at >= v_control.activation_boundary
       AND job.eligible_at <= now()
       AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= now())
       AND (job.status <> 'processing' OR job.lease_expires_at IS NULL OR job.lease_expires_at <= now())
       AND (
         v_control.paid_access_customers_admitted
         OR job.customer_id = v_control.controlled_paid_customer_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions suppression
          WHERE suppression.email_normalized = account.email_normalized
            AND suppression.reason IN ('hard_bounce', 'complaint')
       )
     ORDER BY COALESCE(job.next_attempt_at, job.eligible_at), job.created_at, job.job_id
     FOR UPDATE OF job SKIP LOCKED
     LIMIT LEAST(GREATEST(p_limit, 0), v_remaining)
  )
  UPDATE public.paid_access_email_jobs job
     SET status = 'processing',
         attempt_count = job.attempt_count + 1,
         locked_at = now(),
         lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
         claim_token = gen_random_uuid(),
         updated_at = now()
    FROM due
   WHERE job.job_id = due.job_id
  RETURNING job.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_production_paid_access_provider_attempt(
  p_job_id uuid,
  p_claim_token uuid,
  p_invocation_id uuid,
  p_attempted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.paid_access_email_jobs;
  v_account public.customer_accounts;
  v_control public.email_production_control;
  v_count integer;
  v_attempt_id uuid;
BEGIN
  SELECT * INTO v_job FROM public.paid_access_email_jobs
   WHERE job_id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status <> 'processing'
    OR v_job.claim_token IS NULL OR v_job.claim_token <> p_claim_token
  THEN RETURN jsonb_build_object('outcome', 'lost_lease'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.email_scheduler_invocations invocation
     WHERE invocation.invocation_id = p_invocation_id
       AND invocation.authenticated_at IS NOT NULL
       AND invocation.completed_at IS NULL
  ) THEN RETURN jsonb_build_object('outcome', 'authentication_blocked'); END IF;

  SELECT * INTO v_control FROM public.email_production_control
   WHERE singleton_id = 1 FOR UPDATE;
  IF NOT COALESCE(v_control.sending_enabled, false)
    OR NOT COALESCE(v_control.paid_access_sending_enabled, false)
  THEN RETURN jsonb_build_object('outcome', 'sending_disabled'); END IF;
  IF v_control.activation_boundary IS NULL OR v_job.created_at < v_control.activation_boundary
  THEN RETURN jsonb_build_object('outcome', 'activation_blocked'); END IF;
  IF NOT v_control.paid_access_customers_admitted
    AND v_job.customer_id IS DISTINCT FROM v_control.controlled_paid_customer_id
  THEN RETURN jsonb_build_object('outcome', 'controlled_scope_blocked'); END IF;
  IF NOT (v_job.job_type = 'paid_recovery' AND v_job.entitlement_id IS NULL)
    AND NOT EXISTS (
    SELECT 1 FROM public.paid_product_entitlements entitlement
     WHERE entitlement.id = v_job.entitlement_id
       AND entitlement.customer_id = v_job.customer_id
       AND entitlement.status = 'active'
  ) THEN RETURN jsonb_build_object('outcome', 'entitlement_blocked'); END IF;

  SELECT * INTO v_account FROM public.customer_accounts
   WHERE id = v_job.customer_id FOR SHARE;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.email_suppressions suppression
     WHERE suppression.email_normalized = v_account.email_normalized
       AND suppression.reason IN ('hard_bounce', 'complaint')
  ) THEN RETURN jsonb_build_object('outcome', 'suppression_blocked'); END IF;

  SELECT count(*) INTO v_count FROM public.email_provider_submissions submission
    WHERE submission.reserved_at >= p_attempted_at - interval '24 hours'
      AND submission.status IN ('reserved', 'accepted', 'uncertain');
  IF v_count >= v_control.provider_submission_limit
  THEN RETURN jsonb_build_object('outcome', 'limit_reached'); END IF;

  INSERT INTO public.email_provider_submissions (
    invocation_id, paid_access_job_id, customer_id, job_type, template_version,
    idempotency_key, reserved_at
  ) VALUES (
    p_invocation_id, v_job.job_id, v_job.customer_id, v_job.job_type,
    v_job.template_version, v_job.idempotency_key, p_attempted_at
  ) RETURNING submission_attempt_id INTO v_attempt_id;

  UPDATE public.paid_access_email_jobs
     SET first_provider_attempt_at = COALESCE(first_provider_attempt_at, p_attempted_at),
         updated_at = now()
   WHERE job_id = p_job_id AND claim_token = p_claim_token AND status = 'processing';

  RETURN jsonb_build_object('outcome', 'ok', 'submission_attempt_id', v_attempt_id);
END;
$$;

-- CREATE OR REPLACE retains existing ACLs. Reassert the service-only boundary.
CREATE OR REPLACE FUNCTION public.count_production_eligible_email_jobs()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ((
    SELECT count(*)
      FROM public.email_jobs job
      JOIN public.lead_plans lead ON lead.id = job.lead_plan_id
      CROSS JOIN public.email_production_control control
     WHERE control.singleton_id = 1
       AND control.sending_enabled
       AND control.activation_boundary IS NOT NULL
       AND job.created_at >= control.activation_boundary
       AND job.status IN ('pending', 'retry_scheduled', 'processing')
       AND job.eligible_at <= now()
       AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= now())
       AND (job.status <> 'processing' OR job.lease_expires_at IS NULL OR job.lease_expires_at <= now())
       AND (
         job.job_type = 'recovery'
         OR (
           lead.plan_email_consent_active
           AND lead.plan_email_consent_at IS NOT NULL
           AND job.created_at >= lead.plan_email_consent_at
         )
       )
       AND lead.email_suppressed_at IS NULL
       AND lead.email_suppression_reason IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions suppression
          WHERE suppression.email_normalized = lead.email_normalized
            AND suppression.reason IN ('hard_bounce', 'complaint')
       )
       AND (control.genuine_plans_admitted OR job.lead_plan_id = control.controlled_lead_plan_id)
  ) + (
    SELECT count(*)
      FROM public.paid_access_email_jobs job
      JOIN public.customer_accounts account ON account.id = job.customer_id
      LEFT JOIN public.paid_product_entitlements entitlement
        ON entitlement.id = job.entitlement_id
       AND entitlement.customer_id = job.customer_id
       AND entitlement.status = 'active'
      CROSS JOIN public.email_production_control control
     WHERE ((job.job_type = 'paid_recovery' AND job.entitlement_id IS NULL)
         OR entitlement.id IS NOT NULL)
       AND control.singleton_id = 1
       AND control.sending_enabled
       AND control.paid_access_sending_enabled
       AND control.activation_boundary IS NOT NULL
       AND job.created_at >= control.activation_boundary
       AND job.status IN ('pending', 'retry_scheduled', 'processing')
       AND job.eligible_at <= now()
       AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= now())
       AND (job.status <> 'processing' OR job.lease_expires_at IS NULL OR job.lease_expires_at <= now())
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions suppression
          WHERE suppression.email_normalized = account.email_normalized
            AND suppression.reason IN ('hard_bounce', 'complaint')
       )
       AND (
         control.paid_access_customers_admitted
         OR job.customer_id = control.controlled_paid_customer_id
       )
  ) + (
    SELECT count(*) FROM public.lead_intake_welcome_jobs j
      JOIN public.lead_intakes i ON i.intake_id=j.intake_id
      CROSS JOIN public.email_production_control c
    WHERE c.singleton_id=1 AND c.sending_enabled AND c.activation_boundary IS NOT NULL
      AND j.created_at >= c.activation_boundary
      AND j.status IN ('pending','retry_scheduled','processing')
      AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= now())
      AND (j.status <> 'processing' OR j.lease_expires_at <= now())
      AND (c.genuine_plans_admitted OR i.controlled_test)
      AND NOT EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.email_normalized=i.email_normalized AND s.reason IN ('hard_bounce','complaint'))
  ))::integer
$$;

REVOKE ALL ON FUNCTION public.enqueue_paid_access_job(text, uuid, uuid, text, timestamptz),
 public.request_customer_access_recovery(text,text),
 public.claim_production_paid_access_email_jobs(text,uuid,integer,integer),
 public.begin_production_paid_access_provider_attempt(uuid,uuid,uuid,timestamptz)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_paid_access_job(text, uuid, uuid, text, timestamptz),
 public.request_customer_access_recovery(text,text),
 public.claim_production_paid_access_email_jobs(text,uuid,integer,integer),
 public.begin_production_paid_access_provider_attempt(uuid,uuid,uuid,timestamptz)
 TO service_role;
