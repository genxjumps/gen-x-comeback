-- ============================================================
-- Email 1 (Plan Ready) hardening. Additive: no data is deleted.
-- ============================================================

-- ---------- enum extension ----------
ALTER TYPE public.email_job_status ADD VALUE IF NOT EXISTS 'manual_review';

-- ---------- plan_submissions binding columns ----------
ALTER TABLE public.plan_submissions
  ADD COLUMN IF NOT EXISTS session_token_hash text,
  ADD COLUMN IF NOT EXISTS request_fingerprint text,
  ADD COLUMN IF NOT EXISTS email_normalized text;

-- Backfill what is safely derivable for existing rows.
UPDATE public.plan_submissions s
   SET email_normalized = l.email_normalized
  FROM public.lead_plans l
 WHERE s.lead_plan_id = l.id
   AND s.email_normalized IS NULL;

CREATE INDEX IF NOT EXISTS plan_submissions_fingerprint_idx
  ON public.plan_submissions (request_fingerprint);

-- ---------- email_jobs lease fencing + idempotency horizon ----------
ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS first_provider_attempt_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS manual_review_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS email_jobs_claim_token_idx ON public.email_jobs (claim_token);

-- ---------- one return token per logical job ----------
ALTER TABLE public.plan_return_tokens
  ADD COLUMN IF NOT EXISTS job_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS plan_return_tokens_token_hash_key
  ON public.plan_return_tokens (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS plan_return_tokens_job_key
  ON public.plan_return_tokens (job_id) WHERE job_id IS NOT NULL;

-- ---------- provider events: remember kind, link job, reconcile later ----------
ALTER TABLE public.email_provider_events
  ADD COLUMN IF NOT EXISTS event_kind text,
  ADD COLUMN IF NOT EXISTS suppression text,
  ADD COLUMN IF NOT EXISTS matched_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS email_provider_events_provider_event_key
  ON public.email_provider_events (provider_key, provider_event_id);

CREATE INDEX IF NOT EXISTS email_provider_events_unmatched_idx
  ON public.email_provider_events (provider_key, provider_message_id)
  WHERE job_id IS NULL;

-- ---------- durable rate limiting ----------
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  bucket_key text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_counters TO service_role;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages rate limit counters" ON public.rate_limit_counters;
CREATE POLICY "Service role manages rate limit counters" ON public.rate_limit_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------- additive integrity constraints (NOT VALID: existing rows untouched) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_events_lead_plan_fk') THEN
    ALTER TABLE public.canonical_events
      ADD CONSTRAINT canonical_events_lead_plan_fk
      FOREIGN KEY (lead_plan_id) REFERENCES public.lead_plans(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_return_tokens_job_fk') THEN
    ALTER TABLE public.plan_return_tokens
      ADD CONSTRAINT plan_return_tokens_job_fk
      FOREIGN KEY (job_id) REFERENCES public.email_jobs(job_id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operational_alerts_job_fk') THEN
    ALTER TABLE public.operational_alerts
      ADD CONSTRAINT operational_alerts_job_fk
      FOREIGN KEY (job_id) REFERENCES public.email_jobs(job_id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_jobs_attempt_count_chk') THEN
    ALTER TABLE public.email_jobs
      ADD CONSTRAINT email_jobs_attempt_count_chk CHECK (attempt_count >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_plan_day_completions_day_chk') THEN
    ALTER TABLE public.lead_plan_day_completions
      ADD CONSTRAINT lead_plan_day_completions_day_chk
      CHECK (day_number BETWEEN 1 AND 7) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_submissions_source_chk') THEN
    ALTER TABLE public.plan_submissions
      ADD CONSTRAINT plan_submissions_source_chk
      CHECK (source IN ('new_plan','reassessment','unchanged')) NOT VALID;
  END IF;
END $$;

-- ============================================================
-- Delivery ordering helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.email_delivery_rank(p_status public.email_delivery_status)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_status
    WHEN 'pending' THEN 0
    WHEN 'delayed' THEN 1
    WHEN 'delivered' THEN 2
    WHEN 'bounced' THEN 3
    WHEN 'complained' THEN 4
    ELSE 0 END
$$;

-- ============================================================
-- Compare-and-set delivery transition (out-of-order safe)
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_email_delivery_event(
  p_job_id uuid,
  p_kind public.email_delivery_status,
  p_occurred_at timestamp with time zone DEFAULT now()
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job public.email_jobs;
  v_at timestamptz := COALESCE(p_occurred_at, now());
BEGIN
  SELECT * INTO v_job FROM public.email_jobs WHERE job_id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF public.email_delivery_rank(p_kind) <= public.email_delivery_rank(v_job.delivery_status) THEN
    RETURN false;
  END IF;

  UPDATE public.email_jobs
     SET delivery_status = p_kind,
         delivered_at = CASE WHEN p_kind = 'delivered' THEN v_at ELSE delivered_at END,
         updated_at = now()
   WHERE job_id = p_job_id;

  IF p_kind = 'delivered' THEN
    INSERT INTO public.canonical_events
      (event_name, lead_plan_id, plan_version_id, job_id, occurred_at)
    VALUES ('email_plan_ready_delivered', v_job.lead_plan_id, v_job.plan_version_id, p_job_id, v_at);
  END IF;

  RETURN true;
END $$;

-- ============================================================
-- Fenced, atomic job termination + canonical event
-- ============================================================
CREATE OR REPLACE FUNCTION public.finish_email_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_status public.email_job_status,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_event_name text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead uuid;
  v_version uuid;
  v_now timestamptz := now();
BEGIN
  UPDATE public.email_jobs SET
    status = p_status,
    locked_at = NULL,
    lease_expires_at = NULL,
    claim_token = NULL,
    next_attempt_at = NULLIF(p_patch->>'next_attempt_at','')::timestamptz,
    last_error_code = COALESCE(p_patch->>'last_error_code', last_error_code),
    last_error_at = COALESCE(NULLIF(p_patch->>'last_error_at','')::timestamptz, last_error_at),
    provider_key = COALESCE(p_patch->>'provider_key', provider_key),
    provider_message_id = COALESCE(p_patch->>'provider_message_id', provider_message_id),
    provider_accepted_at = COALESCE(NULLIF(p_patch->>'provider_accepted_at','')::timestamptz, provider_accepted_at),
    suppression_reason = COALESCE(p_patch->>'suppression_reason', suppression_reason),
    canceled_at = COALESCE(NULLIF(p_patch->>'canceled_at','')::timestamptz, canceled_at),
    manual_review_at = COALESCE(NULLIF(p_patch->>'manual_review_at','')::timestamptz, manual_review_at),
    first_provider_attempt_at = COALESCE(first_provider_attempt_at, NULLIF(p_patch->>'first_provider_attempt_at','')::timestamptz),
    updated_at = v_now
  WHERE job_id = p_job_id
    AND claim_token = p_claim_token
    AND status = 'processing'
  RETURNING lead_plan_id, plan_version_id INTO v_lead, v_version;

  IF v_lead IS NULL THEN
    RETURN false;
  END IF;

  IF p_event_name IS NOT NULL THEN
    INSERT INTO public.canonical_events
      (event_name, lead_plan_id, plan_version_id, job_id, occurred_at)
    VALUES (p_event_name, v_lead, v_version, p_job_id, v_now);
  END IF;

  RETURN true;
END $$;

-- ============================================================
-- Claiming with a fencing token
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_email_jobs(
  p_job_type text,
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 120
) RETURNS SETOF public.email_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
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
        AND c.status IN ('pending','retry_scheduled','processing')
        AND c.eligible_at <= v_now
        AND (c.next_attempt_at IS NULL OR c.next_attempt_at <= v_now)
        AND (c.status <> 'processing' OR c.lease_expires_at IS NULL OR c.lease_expires_at < v_now)
      ORDER BY c.eligible_at ASC
        FOR UPDATE SKIP LOCKED
      LIMIT p_limit
   )
  RETURNING j.*;
END $$;

-- ============================================================
-- One stale alert per job, atomically
-- ============================================================
CREATE OR REPLACE FUNCTION public.raise_stale_email_job_alerts(
  p_job_type text,
  p_cutoff timestamp with time zone
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH due AS (
    UPDATE public.email_jobs j
       SET alerted_stale_at = now(), updated_at = now()
     WHERE j.job_type = p_job_type
       AND j.created_at < p_cutoff
       AND j.alerted_stale_at IS NULL
       AND j.status IN ('pending','processing','retry_scheduled')
    RETURNING j.job_id, j.lead_plan_id, j.created_at, j.status
  ), ins AS (
    INSERT INTO public.operational_alerts (alert_type, severity, job_id, lead_plan_id, details)
    SELECT 'plan_ready_pending_too_long', 'warning', d.job_id, d.lead_plan_id,
           jsonb_build_object('created_at', d.created_at, 'job_status', d.status::text)
      FROM due d
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM ins;
  RETURN v_count;
END $$;

-- ============================================================
-- Durable rate limiting
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket text,
  p_window_seconds integer,
  p_limit integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window timestamptz;
  v_attempts integer;
BEGIN
  IF p_bucket IS NULL OR length(p_bucket) = 0 THEN RETURN false; END IF;
  v_window := to_timestamp(floor(extract(epoch FROM now()) / GREATEST(p_window_seconds, 1))
                           * GREATEST(p_window_seconds, 1));

  INSERT INTO public.rate_limit_counters (bucket_key, window_start, attempts)
  VALUES (p_bucket, v_window, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET attempts = rate_limit_counters.attempts + 1, updated_at = now()
  RETURNING attempts INTO v_attempts;

  DELETE FROM public.rate_limit_counters WHERE window_start < now() - interval '1 day';

  RETURN v_attempts <= p_limit;
END $$;

-- ============================================================
-- Rewritten atomic plan commit
--   * changed vs unchanged decided from authoritative stored JSON
--   * submission bound to lead + session hash + request fingerprint
--   * replay of a replaced version grants nothing
-- ============================================================
DROP FUNCTION IF EXISTS public.commit_plan_version(uuid, jsonb, jsonb, text, uuid, text, text, text, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.commit_plan_version(
  p_submission_id uuid,
  p_assessment jsonb,
  p_plan jsonb,
  p_session_token_hash text,
  p_request_fingerprint text,
  p_lead_plan_id uuid DEFAULT NULL,
  p_email_normalized text DEFAULT NULL,
  p_email_original text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_consent_copy text DEFAULT NULL,
  p_consent_version text DEFAULT NULL
) RETURNS TABLE(
  lead_plan_id uuid,
  plan_version_id uuid,
  job_id uuid,
  first_name text,
  source text,
  replayed boolean,
  outcome text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.plan_submissions;
  v_lead public.lead_plans;
  v_lead_id uuid;
  v_version uuid;
  v_job_id uuid;
  v_event_id uuid;
  v_source text;
  v_changed boolean;
  v_now timestamptz := now();
BEGIN
  IF p_submission_id IS NULL OR p_session_token_hash IS NULL OR p_request_fingerprint IS NULL THEN
    RAISE EXCEPTION 'submission identity is required';
  END IF;

  SELECT * INTO v_existing FROM public.plan_submissions WHERE submission_id = p_submission_id;
  IF FOUND THEN
    -- Reusing a submission id with any different binding is a conflict and
    -- discloses nothing about the original lead.
    IF (v_existing.request_fingerprint IS NOT NULL
        AND v_existing.request_fingerprint <> p_request_fingerprint)
    OR (v_existing.session_token_hash IS NOT NULL
        AND v_existing.session_token_hash <> p_session_token_hash)
    OR (p_email_normalized IS NOT NULL AND v_existing.email_normalized IS NOT NULL
        AND v_existing.email_normalized <> p_email_normalized)
    OR (p_lead_plan_id IS NOT NULL AND v_existing.lead_plan_id <> p_lead_plan_id) THEN
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text,
                          'conflict'::text, false, 'conflict'::text;
      RETURN;
    END IF;

    SELECT * INTO v_lead FROM public.lead_plans WHERE id = v_existing.lead_plan_id;
    IF v_lead.id IS NULL OR v_lead.plan_version_id <> v_existing.plan_version_id THEN
      -- The plan this submission created was replaced. No access is granted.
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text,
                          'stale_replay'::text, true, 'stale_replay'::text;
      RETURN;
    END IF;

    -- Exact replay: no new plan, job, event, token, session, or send.
    RETURN QUERY SELECT v_existing.lead_plan_id, v_existing.plan_version_id, v_existing.job_id,
                        v_lead.first_name, v_existing.source, true, 'replay'::text;
    RETURN;
  END IF;

  IF p_lead_plan_id IS NOT NULL THEN
    SELECT * INTO v_lead FROM public.lead_plans WHERE id = p_lead_plan_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lead plan not found';
    END IF;
  ELSIF p_email_normalized IS NOT NULL THEN
    SELECT * INTO v_lead FROM public.lead_plans WHERE email_normalized = p_email_normalized FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'lead identity is required';
  END IF;

  IF v_lead.id IS NULL THEN
    v_source := 'new_plan';
    v_version := gen_random_uuid();
    INSERT INTO public.lead_plans (
      email_normalized, email_original, first_name, consent_granted, consent_copy,
      consent_version, consent_at, assessment_json, plan_json, plan_version_id,
      created_at, updated_at
    ) VALUES (
      p_email_normalized, COALESCE(p_email_original, p_email_normalized),
      COALESCE(p_first_name, 'there'), true, COALESCE(p_consent_copy, ''),
      COALESCE(p_consent_version, 'v1'), v_now, p_assessment, p_plan, v_version, v_now, v_now
    )
    RETURNING * INTO v_lead;
    v_lead_id := v_lead.id;
  ELSE
    v_lead_id := v_lead.id;
    -- Authoritative comparison against stored JSON. No client flag is trusted.
    v_changed := (v_lead.assessment_json IS DISTINCT FROM p_assessment)
              OR (v_lead.plan_json IS DISTINCT FROM p_plan);

    IF NOT v_changed THEN
      -- Identical reload: version, progress, jobs, tokens and sessions all persist.
      INSERT INTO public.plan_access_sessions (lead_plan_id, plan_version_id, token_hash)
      VALUES (v_lead_id, v_lead.plan_version_id, p_session_token_hash)
      ON CONFLICT (token_hash) DO NOTHING;
      UPDATE public.lead_plans
         SET access_token_hash = p_session_token_hash, updated_at = v_now
       WHERE id = v_lead_id;

      SELECT j.job_id INTO v_job_id FROM public.email_jobs j
        WHERE j.plan_version_id = v_lead.plan_version_id AND j.job_type = 'plan_ready' LIMIT 1;

      INSERT INTO public.plan_submissions (
        submission_id, lead_plan_id, plan_version_id, source, job_id,
        session_token_hash, request_fingerprint, email_normalized
      ) VALUES (
        p_submission_id, v_lead_id, v_lead.plan_version_id, 'unchanged', v_job_id,
        p_session_token_hash, p_request_fingerprint, v_lead.email_normalized
      );

      RETURN QUERY SELECT v_lead_id, v_lead.plan_version_id, v_job_id,
                          v_lead.first_name, 'unchanged'::text, false, 'unchanged'::text;
      RETURN;
    END IF;

    v_source := 'reassessment';
    v_version := gen_random_uuid();

    UPDATE public.email_jobs
      SET status = 'canceled', canceled_at = v_now, claim_token = NULL,
          locked_at = NULL, lease_expires_at = NULL, updated_at = v_now
      WHERE plan_version_id = v_lead.plan_version_id
        AND status IN ('pending','processing','retry_scheduled');
    UPDATE public.plan_return_tokens
      SET revoked_at = v_now
      WHERE lead_plan_id = v_lead_id AND revoked_at IS NULL;
    UPDATE public.return_link_sessions
      SET revoked_at = v_now
      WHERE lead_plan_id = v_lead_id AND revoked_at IS NULL;
    UPDATE public.plan_access_sessions
      SET revoked_at = v_now
      WHERE lead_plan_id = v_lead_id AND revoked_at IS NULL;
    DELETE FROM public.lead_plan_day_completions WHERE lead_plan_id = v_lead_id;

    UPDATE public.lead_plans SET
      first_name = COALESCE(p_first_name, first_name),
      email_original = COALESCE(p_email_original, email_original),
      consent_copy = COALESCE(p_consent_copy, consent_copy),
      consent_version = COALESCE(p_consent_version, consent_version),
      consent_at = CASE WHEN p_consent_copy IS NULL THEN consent_at ELSE v_now END,
      assessment_json = p_assessment,
      plan_json = p_plan,
      plan_version_id = v_version,
      updated_at = v_now
    WHERE id = v_lead_id
    RETURNING * INTO v_lead;
  END IF;

  INSERT INTO public.plan_access_sessions (lead_plan_id, plan_version_id, token_hash)
  VALUES (v_lead_id, v_version, p_session_token_hash)
  ON CONFLICT (token_hash) DO NOTHING;
  UPDATE public.lead_plans SET access_token_hash = p_session_token_hash WHERE id = v_lead_id;

  INSERT INTO public.canonical_events
    (event_name, event_version, lead_plan_id, plan_version_id, submission_id, source, occurred_at)
  VALUES ('plan_committed', 'v1', v_lead_id, v_version, p_submission_id, v_source, v_now)
  RETURNING event_id INTO v_event_id;

  INSERT INTO public.email_jobs (
    job_type, job_version, template_version, lead_plan_id, plan_version_id,
    source_event_id, idempotency_key, eligible_at, status, created_at, updated_at
  ) VALUES (
    'plan_ready', 'v1', 'plan_ready_v1', v_lead_id, v_version,
    v_event_id, 'plan_ready:' || v_version::text || ':v1', v_now, 'pending', v_now, v_now
  )
  RETURNING email_jobs.job_id INTO v_job_id;

  INSERT INTO public.canonical_events
    (event_name, lead_plan_id, plan_version_id, submission_id, job_id, occurred_at)
  VALUES ('email_plan_ready_queued', v_lead_id, v_version, p_submission_id, v_job_id, v_now);

  INSERT INTO public.plan_submissions (
    submission_id, lead_plan_id, plan_version_id, source, job_id,
    session_token_hash, request_fingerprint, email_normalized
  ) VALUES (
    p_submission_id, v_lead_id, v_version, v_source, v_job_id,
    p_session_token_hash, p_request_fingerprint, v_lead.email_normalized
  );

  RETURN QUERY SELECT v_lead_id, v_version, v_job_id, v_lead.first_name,
                      v_source, false, v_source;
END $$;

-- ============================================================
-- Least privilege: nothing for PUBLIC / anon / authenticated
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lead_plans','lead_plan_day_completions','plan_submissions','plan_access_sessions',
    'canonical_events','email_jobs','plan_return_tokens','return_link_sessions',
    'email_preference_credentials','email_suppressions','email_provider_events',
    'operational_alerts','rate_limit_counters'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.commit_plan_version(uuid, jsonb, jsonb, text, text, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_plan_version(uuid, jsonb, jsonb, text, text, uuid, text, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_email_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_jobs(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.finish_email_job(uuid, uuid, public.email_job_status, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_email_job(uuid, uuid, public.email_job_status, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.apply_email_delivery_event(uuid, public.email_delivery_status, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_email_delivery_event(uuid, public.email_delivery_status, timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.raise_stale_email_job_alerts(text, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.raise_stale_email_job_alerts(text, timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.email_delivery_rank(public.email_delivery_status) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_rank(public.email_delivery_status) TO service_role;