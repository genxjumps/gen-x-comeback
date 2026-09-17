-- Durable website-to-app intake handoff for the free 7-Day Comeback Plan.
--
-- The public website captures identity and explicit bundled email consent before
-- the assessment. The app stores that intake behind an opaque, expiring browser
-- credential, queues MailerLite independently, and consumes the intake only when
-- the personalized plan is committed. No email address is placed in a URL.

CREATE TABLE public.lead_intakes (
  intake_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  email_normalized text NOT NULL,
  email_original text NOT NULL,
  first_name text NOT NULL,
  consent_copy text NOT NULL,
  consent_version text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'website_hero',
  landing_path text,
  referrer_origin text,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketing_consent_active boolean NOT NULL DEFAULT true,
  marketing_consent_at timestamptz NOT NULL DEFAULT now(),
  bound_submission_id uuid,
  completed_lead_plan_id uuid REFERENCES public.lead_plans(id) ON DELETE SET NULL,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_intakes_source_chk CHECK (source IN ('website_hero','app_signup')),
  CONSTRAINT lead_intakes_first_name_chk CHECK (length(first_name) BETWEEN 1 AND 60),
  CONSTRAINT lead_intakes_email_chk CHECK (length(email_normalized) BETWEEN 3 AND 254),
  CONSTRAINT lead_intakes_token_hash_chk CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT lead_intakes_completion_chk CHECK (
    (completed_at IS NULL AND completed_lead_plan_id IS NULL)
    OR (completed_at IS NOT NULL AND completed_lead_plan_id IS NOT NULL)
  )
);

CREATE INDEX lead_intakes_expiry_idx
  ON public.lead_intakes (expires_at)
  WHERE completed_at IS NULL;

CREATE INDEX lead_intakes_email_idx
  ON public.lead_intakes (email_normalized, created_at DESC);

ALTER TABLE public.lead_intakes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lead_intakes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lead_intakes TO service_role;
CREATE POLICY "Service role manages lead intakes"
  ON public.lead_intakes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE public.lead_intake_marketing_sync_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_intake_id uuid NOT NULL REFERENCES public.lead_intakes(intake_id) ON DELETE CASCADE,
  consent_at timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status public.marketing_sync_job_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  claim_token uuid,
  first_provider_attempt_at timestamptz,
  provider_key text,
  provider_subscriber_id text,
  provider_accepted_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_intake_id, consent_at)
);

CREATE INDEX lead_intake_marketing_sync_dispatch_idx
  ON public.lead_intake_marketing_sync_jobs (status, next_attempt_at, created_at);

ALTER TABLE public.lead_intake_marketing_sync_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lead_intake_marketing_sync_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lead_intake_marketing_sync_jobs TO service_role;
CREATE POLICY "Service role manages lead intake marketing sync"
  ON public.lead_intake_marketing_sync_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.enqueue_lead_intake_marketing_sync_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT and UPDATE stay separate so INSERT never dereferences OLD.
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.marketing_consent_active OR NEW.marketing_consent_at IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF NOT NEW.marketing_consent_active
     OR NEW.marketing_consent_at IS NULL
     OR (
       COALESCE(OLD.marketing_consent_active, false)
       AND NEW.marketing_consent_at IS NOT DISTINCT FROM OLD.marketing_consent_at
     ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.lead_intake_marketing_sync_jobs (
    lead_intake_id, consent_at, idempotency_key
  ) VALUES (
    NEW.intake_id,
    NEW.marketing_consent_at,
    'mailerlite_intake:' || NEW.intake_id::text || ':' ||
      extract(epoch FROM NEW.marketing_consent_at)::text
  )
  ON CONFLICT (lead_intake_id, consent_at) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER enqueue_lead_intake_marketing_sync_after_consent
  AFTER INSERT OR UPDATE OF marketing_consent_active, marketing_consent_at
  ON public.lead_intakes
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_intake_marketing_sync_job();

CREATE OR REPLACE FUNCTION public.claim_lead_intake_for_plan(
  p_token_hash text,
  p_submission_id uuid
)
RETURNS TABLE(
  intake_id uuid,
  email_normalized text,
  email_original text,
  first_name text,
  consent_copy text,
  consent_version text,
  consent_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_intake public.lead_intakes;
BEGIN
  IF p_token_hash IS NULL OR p_submission_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_intake
    FROM public.lead_intakes
   WHERE token_hash = p_token_hash
   FOR UPDATE;

  IF NOT FOUND OR v_intake.expires_at <= now() THEN RETURN; END IF;
  IF v_intake.bound_submission_id IS NOT NULL
     AND v_intake.bound_submission_id <> p_submission_id THEN RETURN; END IF;

  IF v_intake.bound_submission_id IS NULL THEN
    UPDATE public.lead_intakes
       SET bound_submission_id = p_submission_id, updated_at = now()
     WHERE lead_intakes.intake_id = v_intake.intake_id;
  END IF;

  RETURN QUERY SELECT
    v_intake.intake_id,
    v_intake.email_normalized,
    v_intake.email_original,
    v_intake.first_name,
    v_intake.consent_copy,
    v_intake.consent_version,
    v_intake.consent_at;
END $$;

CREATE OR REPLACE FUNCTION public.complete_lead_intake(
  p_intake_id uuid,
  p_submission_id uuid,
  p_lead_plan_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lead_intakes
     SET completed_lead_plan_id = p_lead_plan_id,
         completed_at = COALESCE(completed_at, now()),
         updated_at = now()
   WHERE intake_id = p_intake_id
     AND bound_submission_id = p_submission_id
     AND (completed_lead_plan_id IS NULL OR completed_lead_plan_id = p_lead_plan_id);
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.claim_lead_intake_marketing_sync_jobs(
  p_limit integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 60
)
RETURNS SETOF public.lead_intake_marketing_sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 25 OR p_lease_seconds < 10 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'invalid marketing sync claim bounds';
  END IF;

  RETURN QUERY
  WITH claimable AS (
    SELECT j.job_id
      FROM public.lead_intake_marketing_sync_jobs j
     WHERE (
       j.status = 'pending'
       OR (j.status = 'retry_scheduled' AND j.next_attempt_at <= now())
       OR (j.status = 'processing' AND j.lease_expires_at <= now())
     )
       AND j.attempt_count < 6
     ORDER BY j.created_at, j.job_id
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  )
  UPDATE public.lead_intake_marketing_sync_jobs j
     SET status = 'processing',
         attempt_count = j.attempt_count + 1,
         locked_at = now(),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         claim_token = gen_random_uuid(),
         updated_at = now()
    FROM claimable c
   WHERE j.job_id = c.job_id
  RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION public.begin_lead_intake_marketing_sync_attempt(
  p_job_id uuid,
  p_claim_token uuid,
  p_attempted_at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.lead_intake_marketing_sync_jobs;
  v_intake public.lead_intakes;
BEGIN
  SELECT * INTO v_job
    FROM public.lead_intake_marketing_sync_jobs
   WHERE job_id = p_job_id
   FOR UPDATE;

  IF NOT FOUND OR v_job.status <> 'processing'
     OR v_job.claim_token IS DISTINCT FROM p_claim_token
     OR v_job.lease_expires_at <= p_attempted_at THEN
    RETURN 'lost_lease';
  END IF;

  SELECT * INTO v_intake
    FROM public.lead_intakes
   WHERE intake_id = v_job.lead_intake_id
   FOR UPDATE;

  IF NOT FOUND OR NOT v_intake.marketing_consent_active THEN RETURN 'consent_blocked'; END IF;
  IF v_intake.marketing_consent_at IS DISTINCT FROM v_job.consent_at THEN
    RETURN 'stale_consent';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.email_suppressions s
     WHERE s.email_normalized = v_intake.email_normalized
       AND s.reason IN ('hard_bounce', 'complaint')
  ) THEN
    RETURN 'suppression_blocked';
  END IF;

  UPDATE public.lead_intake_marketing_sync_jobs
     SET first_provider_attempt_at = COALESCE(first_provider_attempt_at, p_attempted_at),
         updated_at = p_attempted_at
   WHERE job_id = p_job_id;
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.finish_lead_intake_marketing_sync_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_status text,
  p_next_attempt_at timestamptz DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_subscriber_id text DEFAULT NULL,
  p_provider_accepted_at timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('provider_accepted','retry_scheduled','failed_permanent','suppressed') THEN
    RAISE EXCEPTION 'invalid marketing sync finish status';
  END IF;
  IF p_status = 'retry_scheduled' AND p_next_attempt_at IS NULL THEN
    RAISE EXCEPTION 'retry requires next attempt';
  END IF;

  UPDATE public.lead_intake_marketing_sync_jobs
     SET status = p_status::public.marketing_sync_job_status,
         next_attempt_at = CASE WHEN p_status = 'retry_scheduled' THEN p_next_attempt_at ELSE NULL END,
         claim_token = NULL,
         locked_at = NULL,
         lease_expires_at = NULL,
         provider_key = CASE WHEN p_status = 'provider_accepted' THEN 'mailerlite' ELSE provider_key END,
         provider_subscriber_id = COALESCE(p_subscriber_id, provider_subscriber_id),
         provider_accepted_at = COALESCE(p_provider_accepted_at, provider_accepted_at),
         last_error_code = p_error_code,
         last_error_at = CASE WHEN p_error_code IS NOT NULL THEN now() ELSE last_error_at END,
         updated_at = now()
   WHERE job_id = p_job_id
     AND status = 'processing'
     AND claim_token = p_claim_token;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.enqueue_lead_intake_marketing_sync_job() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_lead_intake_for_plan(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_lead_intake(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_lead_intake_marketing_sync_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_lead_intake_marketing_sync_attempt(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_lead_intake_marketing_sync_job(uuid, uuid, text, timestamptz, text, text, timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_lead_intake_for_plan(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_lead_intake(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_lead_intake_marketing_sync_jobs(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_lead_intake_marketing_sync_attempt(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_lead_intake_marketing_sync_job(uuid, uuid, text, timestamptz, text, text, timestamptz) TO service_role;
