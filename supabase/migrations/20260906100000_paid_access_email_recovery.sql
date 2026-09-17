-- Transactional backup access and passwordless recovery for paid programs.
--
-- This is intentionally separate from the free 7-Day lead-plan lifecycle. Paid
-- access email never consults marketing or Plan-email consent. It shares only
-- the production scheduler, global provider-volume ceiling, and hard-bounce /
-- complaint suppression boundary.

CREATE TABLE public.paid_access_email_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('paid_purchase_access', 'paid_recovery')),
  job_version text NOT NULL DEFAULT 'v1' CHECK (job_version = 'v1'),
  template_version text NOT NULL CHECK (template_version = 'paid_access_v1'),
  customer_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  entitlement_id uuid NOT NULL REFERENCES public.paid_product_entitlements(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  eligible_at timestamptz NOT NULL DEFAULT now(),
  status public.email_job_status NOT NULL DEFAULT 'pending',
  delivery_status public.email_delivery_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  claim_token uuid,
  first_provider_attempt_at timestamptz,
  provider_key text,
  provider_message_id text,
  provider_accepted_at timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  canceled_at timestamptz,
  suppression_reason text,
  manual_review_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX paid_access_email_jobs_dispatch_idx
  ON public.paid_access_email_jobs (status, eligible_at, next_attempt_at);
CREATE INDEX paid_access_email_jobs_customer_idx
  ON public.paid_access_email_jobs (customer_id, created_at DESC);
CREATE INDEX paid_access_email_jobs_provider_idx
  ON public.paid_access_email_jobs (provider_key, provider_message_id);

CREATE TABLE public.paid_access_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  entitlement_id uuid NOT NULL REFERENCES public.paid_product_entitlements(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL REFERENCES public.paid_access_email_jobs(job_id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX paid_access_tokens_customer_idx
  ON public.paid_access_tokens (customer_id, expires_at DESC);

CREATE TABLE public.paid_access_email_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  job_id uuid REFERENCES public.paid_access_email_jobs(job_id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customer_accounts(id) ON DELETE SET NULL,
  entitlement_id uuid REFERENCES public.paid_product_entitlements(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX paid_access_email_events_customer_idx
  ON public.paid_access_email_events (customer_id, occurred_at DESC);

ALTER TABLE public.paid_access_email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_access_email_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.paid_access_email_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paid_access_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paid_access_email_events FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.paid_access_email_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.paid_access_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.paid_access_email_events TO service_role;

CREATE POLICY "Service role manages paid access email jobs"
  ON public.paid_access_email_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages paid access tokens"
  ON public.paid_access_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages paid access email events"
  ON public.paid_access_email_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Paid access sending has its own fail-closed activation boundary. During
-- controlled testing, exactly one customer may be admitted. Public admission is
-- a later explicit launch action.
ALTER TABLE public.email_production_control
  ADD COLUMN paid_access_sending_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN paid_access_customers_admitted boolean NOT NULL DEFAULT false,
  ADD COLUMN controlled_paid_customer_id uuid REFERENCES public.customer_accounts(id) ON DELETE SET NULL;

-- Associate signed provider events with either the established lead-plan job
-- or the new paid-access job without weakening the existing relationship.
ALTER TABLE public.email_provider_events
  ADD COLUMN paid_access_job_id uuid REFERENCES public.paid_access_email_jobs(job_id) ON DELETE SET NULL,
  ADD CONSTRAINT email_provider_event_job_owner_check CHECK (
    job_id IS NULL OR paid_access_job_id IS NULL
  );

-- Paid and free-plan messages share one provider reservation ledger. Existing
-- rows keep their lead-plan relationship; new paid rows carry the alternate
-- customer/job relationship. The global rolling limit therefore remains exact.
ALTER TABLE public.email_provider_submissions
  ALTER COLUMN job_id DROP NOT NULL,
  ALTER COLUMN lead_plan_id DROP NOT NULL,
  ADD COLUMN paid_access_job_id uuid REFERENCES public.paid_access_email_jobs(job_id),
  ADD COLUMN customer_id uuid REFERENCES public.customer_accounts(id),
  ADD CONSTRAINT email_provider_submission_owner_check CHECK (
    (job_id IS NOT NULL AND lead_plan_id IS NOT NULL
      AND paid_access_job_id IS NULL AND customer_id IS NULL)
    OR
    (job_id IS NULL AND lead_plan_id IS NULL
      AND paid_access_job_id IS NOT NULL AND customer_id IS NOT NULL)
  );

CREATE INDEX email_provider_submissions_paid_job_idx
  ON public.email_provider_submissions (paid_access_job_id, reserved_at);

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
    OR p_customer_id IS NULL OR p_entitlement_id IS NULL
    OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0
    OR NOT EXISTS (
      SELECT 1 FROM public.paid_product_entitlements entitlement
       WHERE entitlement.id = p_entitlement_id
         AND entitlement.customer_id = p_customer_id
         AND entitlement.status = 'active'
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

REVOKE ALL ON FUNCTION public.enqueue_paid_access_job(text, uuid, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_paid_access_job(text, uuid, uuid, text, timestamptz)
  TO service_role;

-- Non-enumerating account recovery. A paid entitlement wins over a matching
-- free plan so one request never sends two access messages. Free-only recovery
-- retains the existing transactional path unchanged.
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
  v_entitlement_id uuid;
BEGIN
  IF p_email_normalized IS NULL
    OR p_email_normalized <> lower(btrim(p_email_normalized))
    OR length(p_email_normalized) NOT BETWEEN 3 AND 254
    OR p_request_id IS NULL OR length(btrim(p_request_id)) = 0
  THEN RETURN; END IF;

  SELECT account.id, entitlement.id
    INTO v_customer_id, v_entitlement_id
    FROM public.customer_accounts account
    JOIN public.paid_product_entitlements entitlement
      ON entitlement.customer_id = account.id
     AND entitlement.status = 'active'
   WHERE account.email_normalized = p_email_normalized
   ORDER BY entitlement.granted_at DESC, entitlement.id
   LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    PERFORM public.enqueue_paid_access_job(
      'paid_recovery', v_customer_id, v_entitlement_id,
      'paid_recovery:' || v_customer_id::text || ':' || p_request_id || ':v1', now()
    );
    RETURN;
  END IF;

  PERFORM public.request_plan_recovery(p_email_normalized, p_request_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_customer_access_recovery(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_customer_access_recovery(text, text) TO service_role;

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
      JOIN public.paid_product_entitlements entitlement
        ON entitlement.id = job.entitlement_id
       AND entitlement.customer_id = job.customer_id
       AND entitlement.status = 'active'
     WHERE job.job_type = p_job_type
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
  IF NOT EXISTS (
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

CREATE OR REPLACE FUNCTION public.finish_paid_access_email_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_status public.email_job_status,
  p_patch jsonb,
  p_event_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.paid_access_email_jobs;
BEGIN
  UPDATE public.paid_access_email_jobs job SET
    status = p_status,
    next_attempt_at = CASE WHEN p_patch ? 'next_attempt_at'
      THEN (p_patch->>'next_attempt_at')::timestamptz ELSE job.next_attempt_at END,
    provider_key = COALESCE(p_patch->>'provider_key', job.provider_key),
    provider_message_id = COALESCE(p_patch->>'provider_message_id', job.provider_message_id),
    provider_accepted_at = CASE WHEN p_patch ? 'provider_accepted_at'
      THEN (p_patch->>'provider_accepted_at')::timestamptz ELSE job.provider_accepted_at END,
    last_error_code = COALESCE(p_patch->>'last_error_code', job.last_error_code),
    last_error_at = CASE WHEN p_patch ? 'last_error_at'
      THEN (p_patch->>'last_error_at')::timestamptz ELSE job.last_error_at END,
    suppression_reason = COALESCE(p_patch->>'suppression_reason', job.suppression_reason),
    canceled_at = CASE WHEN p_patch ? 'canceled_at'
      THEN (p_patch->>'canceled_at')::timestamptz ELSE job.canceled_at END,
    manual_review_at = CASE WHEN p_patch ? 'manual_review_at'
      THEN (p_patch->>'manual_review_at')::timestamptz ELSE job.manual_review_at END,
    locked_at = NULL, lease_expires_at = NULL, claim_token = NULL, updated_at = now()
  WHERE job.job_id = p_job_id AND job.claim_token = p_claim_token
    AND job.status = 'processing'
  RETURNING job.* INTO v_job;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_event_name IS NOT NULL THEN
    INSERT INTO public.paid_access_email_events (
      event_name, job_id, customer_id, entitlement_id
    ) VALUES (p_event_name, v_job.job_id, v_job.customer_id, v_job.entitlement_id);
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_production_paid_access_provider_attempt(
  p_submission_attempt_id uuid,
  p_outcome text,
  p_completed_at timestamptz,
  p_provider_key text DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL,
  p_provider_accepted_at timestamptz DEFAULT NULL,
  p_outcome_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_job_id uuid;
  v_duplicate_count integer;
  v_capacity_count integer;
  v_limit integer;
BEGIN
  IF p_outcome = 'accepted' THEN v_status := 'accepted';
  ELSIF p_outcome = 'uncertain' THEN v_status := 'uncertain';
  ELSIF p_outcome IN ('transient', 'permanent') THEN v_status := 'released';
  ELSE RAISE EXCEPTION 'invalid provider outcome'; END IF;

  UPDATE public.email_provider_submissions SET
    status = v_status, completed_at = p_completed_at,
    provider_key = p_provider_key, provider_message_id = p_provider_message_id,
    provider_accepted_at = p_provider_accepted_at, outcome_code = p_outcome_code
  WHERE submission_attempt_id = p_submission_attempt_id AND status = 'reserved'
  RETURNING paid_access_job_id INTO v_job_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_status = 'accepted' THEN
    SELECT count(*) INTO v_duplicate_count
      FROM public.email_provider_submissions
     WHERE paid_access_job_id = v_job_id AND status = 'accepted';
    SELECT provider_submission_limit INTO v_limit
      FROM public.email_production_control WHERE singleton_id = 1;
    SELECT count(*) INTO v_capacity_count FROM public.email_provider_submissions submission
      WHERE submission.reserved_at >= p_completed_at - interval '24 hours'
        AND submission.status IN ('reserved', 'accepted', 'uncertain');
    IF v_duplicate_count > 1 OR v_capacity_count > v_limit THEN
      UPDATE public.email_production_control
         SET sending_enabled = false, paid_access_sending_enabled = false, updated_at = now()
       WHERE singleton_id = 1;
      INSERT INTO public.paid_access_email_events (
        event_name, job_id, occurred_at, details
      ) VALUES (
        CASE WHEN v_duplicate_count > 1 THEN 'duplicate_provider_submission'
          ELSE 'provider_submission_limit_failure' END,
        v_job_id, p_completed_at,
        jsonb_build_object('accepted_for_job', v_duplicate_count,
          'rolling_capacity_count', v_capacity_count,
          'provider_submission_limit', v_limit)
      );
    END IF;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.defer_paid_access_email_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_next_attempt_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.paid_access_email_jobs job SET
    status = 'pending',
    attempt_count = GREATEST(job.attempt_count - 1, 0),
    next_attempt_at = p_next_attempt_at,
    locked_at = NULL,
    lease_expires_at = NULL,
    claim_token = NULL,
    updated_at = now()
  WHERE job.job_id = p_job_id
    AND job.claim_token = p_claim_token
    AND job.status = 'processing';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_paid_access_delivery_event(
  p_job_id uuid,
  p_kind public.email_delivery_status,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.paid_access_email_jobs;
BEGIN
  UPDATE public.paid_access_email_jobs job SET
    delivery_status = p_kind,
    delivered_at = CASE WHEN p_kind = 'delivered'
      THEN COALESCE(job.delivered_at, p_occurred_at) ELSE job.delivered_at END,
    updated_at = now()
  WHERE job.job_id = p_job_id
    AND CASE p_kind
      WHEN 'pending' THEN 0 WHEN 'delayed' THEN 1 WHEN 'delivered' THEN 2
      WHEN 'bounced' THEN 3 WHEN 'complained' THEN 4 ELSE -1 END
      >= CASE job.delivery_status
      WHEN 'pending' THEN 0 WHEN 'delayed' THEN 1 WHEN 'delivered' THEN 2
      WHEN 'bounced' THEN 3 WHEN 'complained' THEN 4 ELSE -1 END
  RETURNING job.* INTO v_job;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.paid_access_email_events (
    event_name, job_id, customer_id, entitlement_id, occurred_at
  ) VALUES (
    'paid_access_' || p_kind::text, v_job.job_id, v_job.customer_id,
    v_job.entitlement_id, COALESCE(p_occurred_at, now())
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_paid_access_provider_events(
  p_job_id uuid,
  p_provider_key text,
  p_provider_message_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_count integer := 0;
BEGIN
  FOR v_event IN
    SELECT id, event_kind, occurred_at FROM public.email_provider_events
     WHERE provider_key = p_provider_key
       AND provider_message_id = p_provider_message_id
       AND reconciled_at IS NULL
       AND event_kind IN ('delivered', 'delayed', 'bounced', 'complained')
     ORDER BY occurred_at, id
  LOOP
    PERFORM public.apply_paid_access_delivery_event(
      p_job_id, v_event.event_kind::public.email_delivery_status, v_event.occurred_at
    );
    UPDATE public.email_provider_events SET
      paid_access_job_id = p_job_id, matched_at = now(), reconciled_at = now()
    WHERE id = v_event.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_production_paid_access_email_jobs(text, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_production_paid_access_provider_attempt(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_paid_access_email_job(uuid, uuid, public.email_job_status, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_production_paid_access_provider_attempt(uuid, text, timestamptz, text, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.defer_paid_access_email_job(uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_paid_access_delivery_event(uuid, public.email_delivery_status, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_paid_access_provider_events(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_production_paid_access_email_jobs(text, uuid, integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_production_paid_access_provider_attempt(uuid, uuid, uuid, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_paid_access_email_job(uuid, uuid, public.email_job_status, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_production_paid_access_provider_attempt(uuid, text, timestamptz, text, text, timestamptz, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.defer_paid_access_email_job(uuid, uuid, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_paid_access_delivery_event(uuid, public.email_delivery_status, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_paid_access_provider_events(uuid, text, text)
  TO service_role;

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
      JOIN public.paid_product_entitlements entitlement
        ON entitlement.id = job.entitlement_id
       AND entitlement.customer_id = job.customer_id
       AND entitlement.status = 'active'
      CROSS JOIN public.email_production_control control
     WHERE control.singleton_id = 1
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
  ))::integer
$$;

REVOKE ALL ON FUNCTION public.count_production_eligible_email_jobs()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_production_eligible_email_jobs() TO service_role;

-- Recreate the ownership transaction so the backup-access outbox write is
-- atomic with durable purchase and entitlement creation.
CREATE OR REPLACE FUNCTION public.provision_accelerator_ownership(
  p_customer_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_purchase_source text,
  p_source_reference text,
  p_purchased_at timestamptz,
  p_product_code text,
  p_amount_cents integer,
  p_currency text
) RETURNS TABLE(
  outcome text, customer_id uuid, purchase_id uuid, entitlement_id uuid, replayed boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_purchase public.paid_purchases%ROWTYPE;
  v_entitlement_id uuid;
BEGIN
  IF p_customer_id IS NULL
    OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0
    OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_purchase_source IS NULL OR length(btrim(p_purchase_source)) = 0
    OR p_source_reference IS NULL OR length(btrim(p_source_reference)) = 0
    OR p_purchased_at IS NULL OR p_product_code <> 'accelerator_28'
    OR p_amount_cents <> 3700 OR p_currency <> 'USD'
    OR NOT EXISTS (SELECT 1 FROM public.customer_accounts account WHERE account.id = p_customer_id)
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_purchase_source || chr(31) || p_source_reference, 1)
  );

  SELECT * INTO v_purchase FROM public.paid_purchases
   WHERE idempotency_key = p_idempotency_key FOR UPDATE;

  IF FOUND THEN
    IF v_purchase.request_fingerprint <> p_request_fingerprint
      OR v_purchase.customer_id <> p_customer_id
    THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
      RETURN;
    END IF;
    SELECT entitlement.id INTO v_entitlement_id
      FROM public.paid_product_entitlements entitlement
     WHERE entitlement.customer_id = p_customer_id
       AND entitlement.product_code = p_product_code;
    IF v_entitlement_id IS NULL THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
      RETURN;
    END IF;
    PERFORM public.enqueue_paid_access_job(
      'paid_purchase_access', p_customer_id, v_entitlement_id,
      'paid_purchase_access:' || v_purchase.id::text || ':v1', now()
    );
    RETURN QUERY SELECT 'replayed'::text, p_customer_id, v_purchase.id, v_entitlement_id, true;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.paid_purchases purchase
    WHERE purchase.purchase_source = p_purchase_source
      AND purchase.source_reference = p_source_reference)
  THEN
    RETURN QUERY SELECT 'conflict'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  INSERT INTO public.paid_purchases (
    customer_id, product_code, amount_cents, currency, purchase_source,
    source_reference, idempotency_key, request_fingerprint, status,
    purchased_at, refund_request_deadline_at
  ) VALUES (
    p_customer_id, p_product_code, p_amount_cents, p_currency, p_purchase_source,
    p_source_reference, p_idempotency_key, p_request_fingerprint, 'paid',
    p_purchased_at, p_purchased_at + interval '7 days'
  ) RETURNING * INTO v_purchase;

  INSERT INTO public.paid_product_entitlements (
    customer_id, purchase_id, product_code, status, granted_at
  ) VALUES (p_customer_id, v_purchase.id, p_product_code, 'active', p_purchased_at)
  ON CONFLICT ON CONSTRAINT paid_product_entitlements_customer_product_unique DO UPDATE
    SET purchase_id = EXCLUDED.purchase_id, status = 'active',
        granted_at = EXCLUDED.granted_at, revoked_at = NULL, updated_at = now()
  RETURNING id INTO v_entitlement_id;

  PERFORM public.enqueue_paid_access_job(
    'paid_purchase_access', p_customer_id, v_entitlement_id,
    'paid_purchase_access:' || v_purchase.id::text || ':v1', now()
  );

  RETURN QUERY SELECT 'created'::text, p_customer_id, v_purchase.id, v_entitlement_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_accelerator_ownership(
  uuid, text, text, text, text, timestamptz, text, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_accelerator_ownership(
  uuid, text, text, text, text, timestamptz, text, integer, text
) TO service_role;
