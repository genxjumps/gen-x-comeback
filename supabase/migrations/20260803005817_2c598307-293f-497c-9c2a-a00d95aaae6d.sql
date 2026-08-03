-- =========================================================
-- Plan Ready (plan_ready_v1) email foundation
-- =========================================================

CREATE TYPE public.email_job_status AS ENUM (
  'pending','processing','retry_scheduled','provider_accepted','failed_permanent','suppressed','canceled'
);

CREATE TYPE public.email_delivery_status AS ENUM (
  'pending','delivered','delayed','bounced','complained'
);

-- ---------- lead_plans: canonical additions ----------
ALTER TABLE public.lead_plans
  ADD COLUMN IF NOT EXISTS plan_version_id uuid,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_last_engaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_suppressed_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_suppression_reason text,
  ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at timestamptz;

UPDATE public.lead_plans SET plan_version_id = gen_random_uuid() WHERE plan_version_id IS NULL;

ALTER TABLE public.lead_plans
  ALTER COLUMN plan_version_id SET NOT NULL,
  ALTER COLUMN plan_version_id SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS lead_plans_plan_version_id_key
  ON public.lead_plans (plan_version_id);

CREATE UNIQUE INDEX IF NOT EXISTS lead_plans_email_normalized_key
  ON public.lead_plans (email_normalized);

-- ---------- plan_submissions (client idempotency) ----------
CREATE TABLE public.plan_submissions (
  submission_id uuid PRIMARY KEY,
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id) ON DELETE CASCADE,
  plan_version_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('new_plan','reassessment','unchanged')),
  job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.plan_submissions TO service_role;
ALTER TABLE public.plan_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages plan submissions" ON public.plan_submissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX plan_submissions_lead_plan_id_idx ON public.plan_submissions (lead_plan_id);

-- ---------- plan_access_sessions (same-browser access) ----------
CREATE TABLE public.plan_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id) ON DELETE CASCADE,
  plan_version_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);
GRANT ALL ON public.plan_access_sessions TO service_role;
ALTER TABLE public.plan_access_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages plan access sessions" ON public.plan_access_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX plan_access_sessions_lead_plan_id_idx ON public.plan_access_sessions (lead_plan_id);

-- ---------- canonical_events (no PII) ----------
CREATE TABLE public.canonical_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  event_version text NOT NULL DEFAULT 'v1',
  lead_plan_id uuid,
  plan_version_id uuid,
  submission_id uuid,
  job_id uuid,
  source text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.canonical_events TO service_role;
ALTER TABLE public.canonical_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages canonical events" ON public.canonical_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX canonical_events_lead_plan_idx ON public.canonical_events (lead_plan_id, occurred_at DESC);
CREATE INDEX canonical_events_name_idx ON public.canonical_events (event_name, occurred_at DESC);
CREATE UNIQUE INDEX canonical_events_plan_committed_key
  ON public.canonical_events (plan_version_id)
  WHERE event_name = 'plan_committed';

-- ---------- email_jobs (durable outbox) ----------
CREATE TABLE public.email_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  job_version text NOT NULL DEFAULT 'v1',
  template_version text NOT NULL,
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id) ON DELETE CASCADE,
  plan_version_id uuid NOT NULL,
  source_event_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  eligible_at timestamptz NOT NULL DEFAULT now(),
  status public.email_job_status NOT NULL DEFAULT 'pending',
  delivery_status public.email_delivery_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  provider_key text,
  provider_message_id text,
  last_error_code text,
  last_error_at timestamptz,
  provider_accepted_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  suppression_reason text,
  alerted_stale_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_jobs TO service_role;
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages email jobs" ON public.email_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX email_jobs_logical_key
  ON public.email_jobs (job_type, plan_version_id, job_version);
CREATE INDEX email_jobs_dispatch_idx
  ON public.email_jobs (status, eligible_at, next_attempt_at);
CREATE INDEX email_jobs_provider_message_idx
  ON public.email_jobs (provider_key, provider_message_id);
CREATE INDEX email_jobs_lead_plan_idx ON public.email_jobs (lead_plan_id);

-- ---------- plan_return_tokens ----------
CREATE TABLE public.plan_return_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id) ON DELETE CASCADE,
  plan_version_id uuid NOT NULL,
  purpose text NOT NULL DEFAULT 'open_plan' CHECK (purpose IN ('open_plan','recovery')),
  token_hash text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.plan_return_tokens TO service_role;
ALTER TABLE public.plan_return_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages plan return tokens" ON public.plan_return_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX plan_return_tokens_version_idx ON public.plan_return_tokens (plan_version_id);

-- ---------- return_link_sessions ----------
CREATE TABLE public.return_link_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash text NOT NULL UNIQUE,
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id) ON DELETE CASCADE,
  plan_version_id uuid NOT NULL,
  token_id uuid REFERENCES public.plan_return_tokens(token_id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz,
  revoked_at timestamptz
);
GRANT ALL ON public.return_link_sessions TO service_role;
ALTER TABLE public.return_link_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages return link sessions" ON public.return_link_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX return_link_sessions_lead_plan_idx ON public.return_link_sessions (lead_plan_id);

-- ---------- email_preference_credentials ----------
CREATE TABLE public.email_preference_credentials (
  credential_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_plan_id uuid NOT NULL UNIQUE REFERENCES public.lead_plans(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'email_preferences' CHECK (purpose = 'email_preferences'),
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
GRANT ALL ON public.email_preference_credentials TO service_role;
ALTER TABLE public.email_preference_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages email preference credentials" ON public.email_preference_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------- email_suppressions ----------
CREATE TABLE public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('hard_bounce','complaint')),
  source text NOT NULL DEFAULT 'provider_webhook',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_normalized, reason)
);
GRANT ALL ON public.email_suppressions TO service_role;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages email suppressions" ON public.email_suppressions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------- email_provider_events (webhook idempotency) ----------
CREATE TABLE public.email_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  provider_message_id text,
  job_id uuid REFERENCES public.email_jobs(job_id) ON DELETE SET NULL,
  occurred_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, provider_event_id)
);
GRANT ALL ON public.email_provider_events TO service_role;
ALTER TABLE public.email_provider_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages email provider events" ON public.email_provider_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------- operational_alerts ----------
CREATE TABLE public.operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  job_id uuid,
  lead_plan_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT ALL ON public.operational_alerts TO service_role;
ALTER TABLE public.operational_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages operational alerts" ON public.operational_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX operational_alerts_type_idx ON public.operational_alerts (alert_type, created_at DESC);

-- =========================================================
-- Atomic plan commit
-- =========================================================
CREATE OR REPLACE FUNCTION public.commit_plan_version(
  p_submission_id uuid,
  p_assessment jsonb,
  p_plan jsonb,
  p_session_token_hash text,
  p_lead_plan_id uuid DEFAULT NULL,
  p_email_normalized text DEFAULT NULL,
  p_email_original text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_consent_copy text DEFAULT NULL,
  p_consent_version text DEFAULT NULL,
  p_preferences_token_hash text DEFAULT NULL,
  p_changed boolean DEFAULT true
)
RETURNS TABLE (
  lead_plan_id uuid,
  plan_version_id uuid,
  job_id uuid,
  first_name text,
  source text,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.plan_submissions;
  v_lead public.lead_plans;
  v_lead_id uuid;
  v_version uuid;
  v_job_id uuid;
  v_event_id uuid;
  v_source text;
  v_now timestamptz := now();
BEGIN
  IF p_submission_id IS NULL THEN
    RAISE EXCEPTION 'submission_id is required';
  END IF;

  -- Exact replay: return the original result, create nothing.
  SELECT * INTO v_existing FROM public.plan_submissions WHERE submission_id = p_submission_id;
  IF FOUND THEN
    SELECT * INTO v_lead FROM public.lead_plans WHERE id = v_existing.lead_plan_id;
    IF p_session_token_hash IS NOT NULL THEN
      INSERT INTO public.plan_access_sessions (lead_plan_id, plan_version_id, token_hash)
      VALUES (v_existing.lead_plan_id, v_existing.plan_version_id, p_session_token_hash)
      ON CONFLICT (token_hash) DO NOTHING;
    END IF;
    RETURN QUERY SELECT v_existing.lead_plan_id, v_existing.plan_version_id, v_existing.job_id,
                        v_lead.first_name, v_existing.source, true;
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
    IF p_changed IS FALSE THEN
      -- Identical reload: keep the current plan version, progress, tokens and job.
      IF p_session_token_hash IS NOT NULL THEN
        INSERT INTO public.plan_access_sessions (lead_plan_id, plan_version_id, token_hash)
        VALUES (v_lead_id, v_lead.plan_version_id, p_session_token_hash)
        ON CONFLICT (token_hash) DO NOTHING;
        UPDATE public.lead_plans SET access_token_hash = p_session_token_hash, updated_at = v_now
        WHERE id = v_lead_id;
      END IF;
      INSERT INTO public.plan_submissions (submission_id, lead_plan_id, plan_version_id, source, job_id)
      VALUES (p_submission_id, v_lead_id, v_lead.plan_version_id, 'unchanged',
              (SELECT j.job_id FROM public.email_jobs j
                WHERE j.plan_version_id = v_lead.plan_version_id AND j.job_type = 'plan_ready' LIMIT 1));
      RETURN QUERY SELECT v_lead_id, v_lead.plan_version_id,
        (SELECT j.job_id FROM public.email_jobs j
          WHERE j.plan_version_id = v_lead.plan_version_id AND j.job_type = 'plan_ready' LIMIT 1),
        v_lead.first_name, 'unchanged'::text, false;
      RETURN;
    END IF;

    v_source := 'reassessment';
    v_version := gen_random_uuid();

    -- The replaced version loses its unsent jobs, its return tokens and its sessions.
    UPDATE public.email_jobs
      SET status = 'canceled', canceled_at = v_now, updated_at = v_now
      WHERE plan_version_id = v_lead.plan_version_id
        AND status IN ('pending','processing','retry_scheduled');
    UPDATE public.plan_return_tokens
      SET revoked_at = v_now
      WHERE plan_version_id = v_lead.plan_version_id AND revoked_at IS NULL;
    UPDATE public.return_link_sessions
      SET revoked_at = v_now
      WHERE plan_version_id = v_lead.plan_version_id AND revoked_at IS NULL;
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

  IF p_session_token_hash IS NOT NULL THEN
    INSERT INTO public.plan_access_sessions (lead_plan_id, plan_version_id, token_hash)
    VALUES (v_lead_id, v_version, p_session_token_hash)
    ON CONFLICT (token_hash) DO NOTHING;
    UPDATE public.lead_plans SET access_token_hash = p_session_token_hash WHERE id = v_lead_id;
  END IF;

  IF p_preferences_token_hash IS NOT NULL THEN
    INSERT INTO public.email_preference_credentials (lead_plan_id, token_hash)
    VALUES (v_lead_id, p_preferences_token_hash)
    ON CONFLICT (lead_plan_id) DO NOTHING;
  END IF;

  INSERT INTO public.canonical_events (event_name, event_version, lead_plan_id, plan_version_id, submission_id, source, occurred_at)
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

  INSERT INTO public.canonical_events (event_name, lead_plan_id, plan_version_id, submission_id, job_id, occurred_at)
  VALUES ('email_plan_ready_queued', v_lead_id, v_version, p_submission_id, v_job_id, v_now);

  INSERT INTO public.plan_submissions (submission_id, lead_plan_id, plan_version_id, source, job_id)
  VALUES (p_submission_id, v_lead_id, v_version, v_source, v_job_id);

  RETURN QUERY SELECT v_lead_id, v_version, v_job_id, v_lead.first_name, v_source, false;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_plan_version(uuid, jsonb, jsonb, text, uuid, text, text, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_plan_version(uuid, jsonb, jsonb, text, uuid, text, text, text, text, text, text, boolean) TO service_role;

-- =========================================================
-- Atomic job claiming (time-limited lease)
-- =========================================================
CREATE OR REPLACE FUNCTION public.claim_email_jobs(
  p_job_type text,
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  RETURN QUERY
  UPDATE public.email_jobs j
     SET status = 'processing',
         attempt_count = j.attempt_count + 1,
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
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_jobs(text, integer, integer) TO service_role;