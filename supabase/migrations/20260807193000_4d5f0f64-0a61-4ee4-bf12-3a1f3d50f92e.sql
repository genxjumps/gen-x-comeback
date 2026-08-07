-- Production email scheduler and controlled soft-launch contract.
--
-- The scheduler secret is generated inside PostgreSQL. Its plaintext exists
-- only in Supabase Vault; the application compares a SHA-256 digest and never
-- stores or logs the bearer value. Production sending remains disabled after
-- this migration until the explicit activation RPC is called.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.email_production_control (
  singleton_id smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  sending_enabled boolean NOT NULL DEFAULT false,
  activation_boundary timestamptz,
  activated_at timestamptz,
  controlled_lead_plan_id uuid REFERENCES public.lead_plans(id) ON DELETE RESTRICT,
  genuine_plans_admitted boolean NOT NULL DEFAULT false,
  provider_submission_limit integer NOT NULL DEFAULT 5
    CHECK (provider_submission_limit BETWEEN 1 AND 25),
  scheduler_secret_sha256 text,
  scheduler_configured_at timestamptz,
  scheduler_url text,
  cron_job_id bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.email_production_control (singleton_id)
VALUES (1)
ON CONFLICT (singleton_id) DO NOTHING;

ALTER TABLE public.email_production_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages email production control"
  ON public.email_production_control FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.email_production_control TO service_role;

CREATE TABLE public.email_scheduler_invocations (
  invocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'cron' CHECK (source IN ('cron', 'manual')),
  invoked_at timestamptz NOT NULL DEFAULT now(),
  auth_deadline timestamptz NOT NULL,
  transport_request_id bigint,
  authenticated_at timestamptz,
  auth_result text CHECK (auth_result IN ('accepted', 'missing', 'invalid', 'stale', 'replayed')),
  completed_at timestamptz,
  dispatch_succeeded boolean,
  sending_enabled boolean,
  claimed_count integer NOT NULL DEFAULT 0,
  provider_attempt_count integer NOT NULL DEFAULT 0,
  provider_accepted_count integer NOT NULL DEFAULT 0,
  eligible_jobs_after integer NOT NULL DEFAULT 0,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_scheduler_invocations_invoked_idx
  ON public.email_scheduler_invocations (invoked_at DESC);

ALTER TABLE public.email_scheduler_invocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages scheduler invocations"
  ON public.email_scheduler_invocations FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.email_scheduler_invocations TO service_role;

CREATE TABLE public.email_scheduler_auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invocation_reference text,
  result text NOT NULL CHECK (result IN ('accepted', 'missing', 'invalid', 'stale', 'replayed')),
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_scheduler_auth_attempts_attempted_idx
  ON public.email_scheduler_auth_attempts (attempted_at DESC);

ALTER TABLE public.email_scheduler_auth_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages scheduler auth attempts"
  ON public.email_scheduler_auth_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.email_scheduler_auth_attempts TO service_role;

CREATE TABLE public.email_provider_submissions (
  submission_attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invocation_id uuid NOT NULL REFERENCES public.email_scheduler_invocations(invocation_id),
  job_id uuid NOT NULL REFERENCES public.email_jobs(job_id),
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id),
  job_type text NOT NULL,
  template_version text NOT NULL,
  idempotency_key text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'accepted', 'uncertain', 'released')),
  provider_key text,
  provider_message_id text,
  provider_accepted_at timestamptz,
  outcome_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_provider_submissions_window_idx
  ON public.email_provider_submissions (reserved_at DESC, status);
CREATE INDEX email_provider_submissions_job_idx
  ON public.email_provider_submissions (job_id, reserved_at);
CREATE INDEX email_provider_submissions_invocation_idx
  ON public.email_provider_submissions (invocation_id, reserved_at);

ALTER TABLE public.email_provider_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages provider submissions"
  ON public.email_provider_submissions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.email_provider_submissions TO service_role;

-- Records malformed authentication without storing any bearer material.
CREATE OR REPLACE FUNCTION public.record_email_scheduler_auth_attempt(
  p_invocation_reference text,
  p_result text,
  p_attempted_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF p_result NOT IN ('missing', 'invalid', 'stale', 'replayed') THEN
    RAISE EXCEPTION 'invalid auth result';
  END IF;
  INSERT INTO public.email_scheduler_auth_attempts (
    invocation_reference, result, attempted_at
  ) VALUES (
    left(p_invocation_reference, 100), p_result, p_attempted_at
  );
END $$;

-- One-time, freshness-bound authentication. The application supplies only the
-- SHA-256 digest of the bearer value, never the value itself.
CREATE OR REPLACE FUNCTION public.authenticate_email_scheduler_invocation(
  p_invocation_id uuid,
  p_secret_sha256 text,
  p_request_timestamp timestamptz,
  p_authenticated_at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_run public.email_scheduler_invocations;
  v_control public.email_production_control;
  v_result text;
BEGIN
  SELECT * INTO v_run
    FROM public.email_scheduler_invocations
   WHERE invocation_id = p_invocation_id
   FOR UPDATE;

  SELECT * INTO v_control
    FROM public.email_production_control
   WHERE singleton_id = 1;

  IF NOT FOUND OR v_run.invocation_id IS NULL THEN
    v_result := 'invalid';
  ELSIF v_run.authenticated_at IS NOT NULL THEN
    v_result := 'replayed';
  ELSIF p_authenticated_at > v_run.auth_deadline
     OR p_authenticated_at < v_run.invoked_at - interval '30 seconds'
     OR abs(extract(epoch FROM (p_request_timestamp - v_run.invoked_at))) > 2 THEN
    v_result := 'stale';
  ELSIF v_control.scheduler_secret_sha256 IS NULL
     OR length(v_control.scheduler_secret_sha256) <> 64
     OR p_secret_sha256 IS NULL
     OR length(p_secret_sha256) <> 64
     OR v_control.scheduler_secret_sha256 <> p_secret_sha256 THEN
    v_result := 'invalid';
  ELSE
    v_result := 'accepted';
    UPDATE public.email_scheduler_invocations
       SET authenticated_at = p_authenticated_at,
           auth_result = 'accepted'
     WHERE invocation_id = p_invocation_id;
  END IF;

  INSERT INTO public.email_scheduler_auth_attempts (
    invocation_reference, result, attempted_at
  ) VALUES (
    p_invocation_id::text, v_result, p_authenticated_at
  );

  IF v_result <> 'accepted' AND v_run.invocation_id IS NOT NULL THEN
    UPDATE public.email_scheduler_invocations
       SET auth_result = v_result
     WHERE invocation_id = p_invocation_id
       AND authenticated_at IS NULL;
  END IF;

  RETURN v_result;
END $$;

-- Final production fence plus volume-slot reservation. Every accepted or
-- unresolved provider submission consumes one rolling-24-hour slot. Active
-- reservations also consume capacity so concurrent workers cannot overshoot.
CREATE OR REPLACE FUNCTION public.begin_production_provider_attempt(
  p_job_id uuid,
  p_claim_token uuid,
  p_invocation_id uuid,
  p_attempted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
  IF NOT FOUND OR NOT COALESCE(v_lead.plan_email_consent_active, false)
     OR v_lead.plan_email_consent_at IS NULL
     OR v_job.created_at < v_lead.plan_email_consent_at THEN
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
END $$;

CREATE OR REPLACE FUNCTION public.complete_production_provider_attempt(
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
SET search_path = 'public'
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
  ELSE RAISE EXCEPTION 'invalid provider outcome';
  END IF;

  UPDATE public.email_provider_submissions
     SET status = v_status,
         completed_at = p_completed_at,
         provider_key = p_provider_key,
         provider_message_id = p_provider_message_id,
         provider_accepted_at = p_provider_accepted_at,
         outcome_code = p_outcome_code
   WHERE submission_attempt_id = p_submission_attempt_id
     AND status = 'reserved'
  RETURNING job_id INTO v_job_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_status = 'accepted' THEN
    SELECT count(*) INTO v_duplicate_count
      FROM public.email_provider_submissions
     WHERE job_id = v_job_id AND status = 'accepted';
    SELECT provider_submission_limit INTO v_limit
      FROM public.email_production_control WHERE singleton_id = 1;
    SELECT count(*) INTO v_capacity_count
      FROM public.email_provider_submissions
     WHERE reserved_at >= p_completed_at - interval '24 hours'
       AND status IN ('reserved', 'accepted', 'uncertain');

    IF v_duplicate_count > 1 OR v_capacity_count > v_limit THEN
      UPDATE public.email_production_control
         SET sending_enabled = false, updated_at = now()
       WHERE singleton_id = 1;
      INSERT INTO public.operational_alerts (
        alert_type, severity, job_id, details
      ) VALUES (
        CASE WHEN v_duplicate_count > 1
          THEN 'duplicate_provider_submission'
          ELSE 'provider_submission_limit_failure' END,
        'critical',
        v_job_id,
        jsonb_build_object(
          'accepted_for_job', v_duplicate_count,
          'rolling_capacity_count', v_capacity_count,
          'provider_submission_limit', v_limit
        )
      );
    END IF;
  END IF;
  RETURN true;
END $$;

-- Production claims are activation-, consent-, suppression-, invocation-,
-- controlled-scope-, and volume-aware before any lease is issued.
CREATE OR REPLACE FUNCTION public.claim_production_email_jobs(
  p_job_type text,
  p_invocation_id uuid,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
       AND l.plan_email_consent_active = true
       AND l.plan_email_consent_at IS NOT NULL
       AND j.created_at >= l.plan_email_consent_at
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
END $$;

CREATE OR REPLACE FUNCTION public.finish_email_scheduler_invocation(
  p_invocation_id uuid,
  p_dispatch_succeeded boolean,
  p_sending_enabled boolean,
  p_claimed_count integer,
  p_eligible_jobs_after integer,
  p_failure_code text DEFAULT NULL,
  p_completed_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.email_scheduler_invocations i
     SET completed_at = p_completed_at,
         dispatch_succeeded = p_dispatch_succeeded,
         sending_enabled = p_sending_enabled,
         claimed_count = GREATEST(p_claimed_count, 0),
         provider_attempt_count = (
           SELECT count(*) FROM public.email_provider_submissions s
            WHERE s.invocation_id = p_invocation_id
         ),
         provider_accepted_count = (
           SELECT count(*) FROM public.email_provider_submissions s
            WHERE s.invocation_id = p_invocation_id
              AND s.status = 'accepted'
         ),
         eligible_jobs_after = GREATEST(p_eligible_jobs_after, 0),
         failure_code = p_failure_code
   WHERE i.invocation_id = p_invocation_id
     AND i.authenticated_at IS NOT NULL
     AND i.completed_at IS NULL;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.count_production_eligible_email_jobs()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT count(*)::integer
    FROM public.email_jobs j
    JOIN public.lead_plans l ON l.id = j.lead_plan_id
    CROSS JOIN public.email_production_control c
   WHERE c.singleton_id = 1
     AND c.sending_enabled
     AND c.activation_boundary IS NOT NULL
     AND j.created_at >= c.activation_boundary
     AND j.status IN ('pending', 'retry_scheduled', 'processing')
     AND j.eligible_at <= now()
     AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= now())
     AND (j.status <> 'processing' OR j.lease_expires_at IS NULL OR j.lease_expires_at <= now())
     AND l.plan_email_consent_active
     AND l.plan_email_consent_at IS NOT NULL
     AND j.created_at >= l.plan_email_consent_at
     AND l.email_suppressed_at IS NULL
     AND l.email_suppression_reason IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.email_suppressions s
        WHERE s.email_normalized = l.email_normalized
          AND s.reason IN ('hard_bounce', 'complaint')
     )
     AND (c.genuine_plans_admitted OR j.lead_plan_id = c.controlled_lead_plan_id)
$$;

-- Replaces the staging-era transport function. Every call creates a durable
-- invocation row before pg_net receives the request.
-- The staging foundation returned void. PostgreSQL requires an explicit drop
-- before changing the production scheduler function to return its invocation
-- UUID for durable transport correlation.
DROP FUNCTION public.invoke_email_dispatch_scheduler();

CREATE FUNCTION public.invoke_email_dispatch_scheduler()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_invocation_id uuid;
  v_invoked_at timestamptz := clock_timestamp();
  v_request_id bigint;
BEGIN
  INSERT INTO public.email_scheduler_invocations (
    source, invoked_at, auth_deadline
  ) VALUES (
    'cron', v_invoked_at, v_invoked_at + interval '10 minutes'
  ) RETURNING invocation_id INTO v_invocation_id;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
   WHERE name = 'email_production_dispatch_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
   WHERE name = 'email_production_scheduler_secret' LIMIT 1;

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL OR btrim(v_secret) = '' THEN
    UPDATE public.email_scheduler_invocations
       SET completed_at = clock_timestamp(), dispatch_succeeded = false,
           sending_enabled = false, failure_code = 'missing_scheduler_configuration'
     WHERE invocation_id = v_invocation_id;
    RETURN v_invocation_id;
  END IF;

  SELECT net.http_post(
    url := btrim(v_url),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || btrim(v_secret),
      'X-Scheduler-Invocation-Id', v_invocation_id::text,
      'X-Scheduler-Timestamp', to_char(v_invoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  ) INTO v_request_id;

  UPDATE public.email_scheduler_invocations
     SET transport_request_id = v_request_id
   WHERE invocation_id = v_invocation_id;
  RETURN v_invocation_id;
END $$;

CREATE OR REPLACE FUNCTION public.configure_email_production_scheduler(p_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text := encode(extensions.gen_random_bytes(48), 'base64');
  v_secret_id uuid;
  v_url_id uuid;
BEGIN
  IF btrim(p_url) <> 'https://app.genxjumps.com/api/public/email/dispatch' THEN
    RAISE EXCEPTION 'production dispatch URL mismatch';
  END IF;

  SELECT id INTO v_secret_id FROM vault.secrets
   WHERE name = 'email_production_scheduler_secret' LIMIT 1;
  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(v_secret, 'email_production_scheduler_secret',
      'Dedicated production email scheduler bearer secret');
  ELSE
    PERFORM vault.update_secret(v_secret_id, v_secret,
      'email_production_scheduler_secret', 'Dedicated production email scheduler bearer secret');
  END IF;

  SELECT id INTO v_url_id FROM vault.secrets
   WHERE name = 'email_production_dispatch_url' LIMIT 1;
  IF v_url_id IS NULL THEN
    PERFORM vault.create_secret(btrim(p_url), 'email_production_dispatch_url',
      'Permanent production email dispatch endpoint');
  ELSE
    PERFORM vault.update_secret(v_url_id, btrim(p_url),
      'email_production_dispatch_url', 'Permanent production email dispatch endpoint');
  END IF;

  UPDATE public.email_production_control
     SET scheduler_secret_sha256 = encode(extensions.digest(v_secret, 'sha256'), 'hex'),
         scheduler_configured_at = clock_timestamp(),
         scheduler_url = btrim(p_url),
         sending_enabled = false,
         updated_at = now()
   WHERE singleton_id = 1;

  RETURN jsonb_build_object(
    'configured', true,
    'url', btrim(p_url),
    'secret_name', 'email_production_scheduler_secret',
    'sending_enabled', false
  );
END $$;

CREATE OR REPLACE FUNCTION public.create_email_production_cron()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job_id bigint;
  v_control public.email_production_control;
BEGIN
  SELECT * INTO v_control FROM public.email_production_control
   WHERE singleton_id = 1;
  IF v_control.scheduler_secret_sha256 IS NULL
     OR v_control.scheduler_url <> 'https://app.genxjumps.com/api/public/email/dispatch' THEN
    RAISE EXCEPTION 'scheduler is not securely configured';
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job
   WHERE jobname = 'email-production-dispatch-every-5-minutes' LIMIT 1;
  IF v_job_id IS NULL THEN
    SELECT cron.schedule(
      'email-production-dispatch-every-5-minutes',
      '*/5 * * * *',
      'SELECT public.invoke_email_dispatch_scheduler();'
    ) INTO v_job_id;
  END IF;
  UPDATE public.email_production_control
     SET cron_job_id = v_job_id, updated_at = now()
   WHERE singleton_id = 1;
  RETURN v_job_id;
END $$;

CREATE OR REPLACE FUNCTION public.pause_email_production_cron()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job
   WHERE jobname = 'email-production-dispatch-every-5-minutes' LIMIT 1;
  IF v_job_id IS NULL THEN RETURN false; END IF;
  PERFORM cron.unschedule(v_job_id);
  UPDATE public.email_production_control
     SET cron_job_id = NULL, updated_at = now()
   WHERE singleton_id = 1;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.establish_email_production_activation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_boundary timestamptz;
  v_canceled integer := 0;
BEGIN
  SELECT activation_boundary INTO v_boundary FROM public.email_production_control
   WHERE singleton_id = 1 FOR UPDATE;
  IF v_boundary IS NULL THEN
    v_boundary := clock_timestamp();
    UPDATE public.email_jobs
       SET status = 'canceled', canceled_at = v_boundary, next_attempt_at = NULL,
           claim_token = NULL, locked_at = NULL, lease_expires_at = NULL,
           last_error_code = 'pre_production_activation', updated_at = now()
     WHERE created_at < v_boundary
       AND status IN ('pending', 'retry_scheduled', 'processing');
    GET DIAGNOSTICS v_canceled = ROW_COUNT;
    UPDATE public.email_production_control
       SET activation_boundary = v_boundary, activated_at = v_boundary,
           controlled_lead_plan_id = NULL, genuine_plans_admitted = false,
           sending_enabled = false, updated_at = now()
     WHERE singleton_id = 1;
  END IF;
  RETURN jsonb_build_object('activation_boundary', v_boundary, 'jobs_canceled', v_canceled);
END $$;

CREATE OR REPLACE FUNCTION public.set_email_production_controlled_plan(p_lead_plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_boundary timestamptz;
BEGIN
  SELECT activation_boundary INTO v_boundary FROM public.email_production_control
   WHERE singleton_id = 1 FOR UPDATE;
  IF v_boundary IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.email_jobs j
    JOIN public.lead_plans l ON l.id = j.lead_plan_id
     WHERE j.lead_plan_id = p_lead_plan_id
       AND j.job_type = 'plan_ready'
       AND j.created_at >= v_boundary
       AND l.email_normalized = 'todd+staging@genxjumps.com'
       AND l.plan_email_consent_active
       AND l.plan_email_consent_at IS NOT NULL
       AND j.created_at >= l.plan_email_consent_at
       AND l.email_suppressed_at IS NULL
       AND l.email_suppression_reason IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions s
          WHERE s.email_normalized = l.email_normalized
            AND s.reason IN ('hard_bounce', 'complaint')
       )
  ) THEN RETURN false; END IF;
  UPDATE public.email_production_control
     SET controlled_lead_plan_id = p_lead_plan_id,
         genuine_plans_admitted = false,
         sending_enabled = false,
         updated_at = now()
   WHERE singleton_id = 1;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.enable_email_production_sending()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_control public.email_production_control;
BEGIN
  SELECT * INTO v_control FROM public.email_production_control
   WHERE singleton_id = 1 FOR UPDATE;
  IF v_control.activation_boundary IS NULL
     OR v_control.controlled_lead_plan_id IS NULL
     OR v_control.cron_job_id IS NULL
     OR v_control.scheduler_secret_sha256 IS NULL
     OR v_control.provider_submission_limit <> 5 THEN RETURN false; END IF;
  UPDATE public.email_production_control
     SET sending_enabled = true, updated_at = now()
   WHERE singleton_id = 1;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.disable_email_production_sending(p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.email_production_control
     SET sending_enabled = false, updated_at = now()
   WHERE singleton_id = 1;
  INSERT INTO public.operational_alerts (alert_type, severity, details)
  VALUES ('production_email_rollback', 'critical',
    jsonb_build_object('reason', left(COALESCE(p_reason, 'manual'), 200)));
  RETURN true;
END $$;

-- Admission is impossible until the controlled Plan Ready message has exactly
-- one production submission, delivery reconciliation, and deliberate secure
-- link exchange attributed to the same job.
CREATE OR REPLACE FUNCTION public.admit_genuine_email_plans()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_control public.email_production_control;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_control FROM public.email_production_control
   WHERE singleton_id = 1 FOR UPDATE;
  IF NOT v_control.sending_enabled OR v_control.controlled_lead_plan_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT j.job_id INTO v_job_id FROM public.email_jobs j
   WHERE j.lead_plan_id = v_control.controlled_lead_plan_id
     AND j.job_type = 'plan_ready'
     AND j.created_at >= v_control.activation_boundary
     AND j.status = 'provider_accepted'
     AND j.delivery_status = 'delivered'
   ORDER BY j.created_at DESC LIMIT 1;
  IF v_job_id IS NULL THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.email_provider_submissions s
       WHERE s.job_id = v_job_id AND s.status = 'accepted') <> 1 THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.email_provider_events pe
      JOIN public.email_jobs j ON j.job_id = pe.job_id
     WHERE pe.job_id = v_job_id
       AND pe.provider_key = j.provider_key
       AND pe.provider_message_id = j.provider_message_id
       AND pe.event_kind = 'delivered'
       AND pe.reconciled_at IS NOT NULL
  ) THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_events e
     WHERE e.job_id = v_job_id
       AND e.event_name = 'email_plan_ready_link_exchange_completed'
  ) THEN RETURN false; END IF;
  UPDATE public.email_production_control
     SET genuine_plans_admitted = true,
         controlled_lead_plan_id = NULL,
         updated_at = now()
   WHERE singleton_id = 1;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.email_production_warning_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
WITH control AS (
  SELECT * FROM public.email_production_control WHERE singleton_id = 1
), recent AS (
  SELECT * FROM public.email_scheduler_invocations
   WHERE authenticated_at IS NOT NULL AND completed_at IS NOT NULL
   ORDER BY invoked_at DESC LIMIT 2
), accepted AS (
  SELECT count(*)::integer AS count FROM public.email_provider_submissions
   WHERE reserved_at >= now() - interval '24 hours'
     AND status IN ('accepted', 'uncertain')
), capacity AS (
  SELECT count(*)::integer AS count FROM public.email_provider_submissions
   WHERE reserved_at >= now() - interval '24 hours'
     AND status IN ('reserved', 'accepted', 'uncertain')
)
SELECT jsonb_build_object(
  'no_successful_authenticated_dispatch_15m',
    c.cron_job_id IS NOT NULL
    AND c.scheduler_configured_at <= now() - interval '15 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.email_scheduler_invocations i
       WHERE i.authenticated_at IS NOT NULL AND i.dispatch_succeeded
         AND i.completed_at >= now() - interval '15 minutes'
    ),
  'two_consecutive_authenticated_failures',
    (SELECT count(*) = 2 AND bool_and(NOT COALESCE(dispatch_succeeded, false)) FROM recent),
  'eligible_jobs_repeatedly_unclaimed',
    (SELECT count(*) = 2 AND bool_and(claimed_count = 0 AND eligible_jobs_after > 0) FROM recent),
  'accepted_or_uncertain_submissions_24h', a.count,
  'reserved_capacity_24h', cap.count,
  'provider_submission_limit', c.provider_submission_limit,
  'provider_submission_limit_reached', cap.count >= c.provider_submission_limit,
  'production_sending_enabled', c.sending_enabled,
  'activation_boundary', c.activation_boundary,
  'genuine_plans_admitted', c.genuine_plans_admitted
)
FROM control c CROSS JOIN accepted a CROSS JOIN capacity cap
$$;

REVOKE ALL ON FUNCTION public.record_email_scheduler_auth_attempt(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.authenticate_email_scheduler_invocation(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_production_provider_attempt(uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_production_provider_attempt(uuid, text, timestamptz, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_production_email_jobs(text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_email_scheduler_invocation(uuid, boolean, boolean, integer, integer, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_production_eligible_email_jobs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoke_email_dispatch_scheduler() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.configure_email_production_scheduler(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_email_production_cron() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pause_email_production_cron() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.establish_email_production_activation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_email_production_controlled_plan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enable_email_production_sending() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.disable_email_production_sending(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admit_genuine_email_plans() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_production_warning_state() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_email_scheduler_auth_attempt(text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.authenticate_email_scheduler_invocation(uuid, text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_production_provider_attempt(uuid, uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_production_provider_attempt(uuid, text, timestamptz, text, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_production_email_jobs(text, uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_email_scheduler_invocation(uuid, boolean, boolean, integer, integer, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_production_eligible_email_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.invoke_email_dispatch_scheduler() TO service_role;
GRANT EXECUTE ON FUNCTION public.configure_email_production_scheduler(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_email_production_cron() TO service_role;
GRANT EXECUTE ON FUNCTION public.pause_email_production_cron() TO service_role;
GRANT EXECUTE ON FUNCTION public.establish_email_production_activation() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_email_production_controlled_plan(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enable_email_production_sending() TO service_role;
GRANT EXECUTE ON FUNCTION public.disable_email_production_sending(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admit_genuine_email_plans() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_production_warning_state() TO service_role;
