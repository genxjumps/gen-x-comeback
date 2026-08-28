-- Durable, consent-gated MailerLite subscriber sync.
--
-- This migration intentionally does not backfill existing leads and does not
-- contain provider credentials. It only queues future marketing-consent
-- activations. The application must also have MARKETING_SYNC_ENABLED=true,
-- MAILERLITE_API_TOKEN, and MAILERLITE_GROUP_ID before any provider call exists.

CREATE TYPE public.marketing_sync_job_status AS ENUM (
  'pending',
  'processing',
  'retry_scheduled',
  'provider_accepted',
  'failed_permanent',
  'suppressed'
);

CREATE TABLE public.marketing_sync_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id) ON DELETE CASCADE,
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
  UNIQUE (lead_plan_id, consent_at)
);

CREATE INDEX marketing_sync_jobs_dispatch_idx
  ON public.marketing_sync_jobs (status, next_attempt_at, created_at);

ALTER TABLE public.marketing_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages marketing sync jobs"
  ON public.marketing_sync_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.marketing_sync_jobs TO service_role;

-- New/fresh marketing consent only. Existing records are deliberately not
-- inserted by this migration, so publishing cannot silently backfill Jason or
-- any test participant into MailerLite.
CREATE OR REPLACE FUNCTION public.enqueue_marketing_sync_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep INSERT and UPDATE branches separate so an INSERT never dereferences
  -- the unavailable OLD record.
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

  INSERT INTO public.marketing_sync_jobs (
    lead_plan_id,
    consent_at,
    idempotency_key
  ) VALUES (
    NEW.id,
    NEW.marketing_consent_at,
    'mailerlite_subscriber:' || NEW.id::text || ':' ||
      extract(epoch FROM NEW.marketing_consent_at)::text
  )
  ON CONFLICT (lead_plan_id, consent_at) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enqueue_marketing_sync_job_after_consent ON public.lead_plans;
CREATE TRIGGER enqueue_marketing_sync_job_after_consent
  AFTER INSERT OR UPDATE OF marketing_consent_active, marketing_consent_at
  ON public.lead_plans
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_marketing_sync_job();

CREATE OR REPLACE FUNCTION public.claim_marketing_sync_jobs(
  p_limit integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 60
)
RETURNS SETOF public.marketing_sync_jobs
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
      FROM public.marketing_sync_jobs j
     WHERE (
       (j.status = 'pending')
       OR (j.status = 'retry_scheduled' AND j.next_attempt_at <= now())
       OR (j.status = 'processing' AND j.lease_expires_at <= now())
     )
       AND j.attempt_count < 6
     ORDER BY j.created_at, j.job_id
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  )
  UPDATE public.marketing_sync_jobs j
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

-- Final consent/suppression fence immediately before the MailerLite request.
CREATE OR REPLACE FUNCTION public.begin_marketing_sync_attempt(
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
  v_job public.marketing_sync_jobs;
  v_lead public.lead_plans;
BEGIN
  SELECT * INTO v_job
    FROM public.marketing_sync_jobs
   WHERE job_id = p_job_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_job.status <> 'processing'
     OR v_job.claim_token IS DISTINCT FROM p_claim_token
     OR v_job.lease_expires_at <= p_attempted_at THEN
    RETURN 'lost_lease';
  END IF;

  SELECT * INTO v_lead
    FROM public.lead_plans
   WHERE id = v_job.lead_plan_id
   FOR UPDATE;

  IF NOT FOUND OR NOT COALESCE(v_lead.marketing_consent_active, false) THEN
    RETURN 'consent_blocked';
  END IF;
  IF v_lead.marketing_consent_at IS DISTINCT FROM v_job.consent_at THEN
    RETURN 'stale_consent';
  END IF;
  IF v_lead.email_suppressed_at IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.email_suppressions s
     WHERE s.email_normalized = v_lead.email_normalized
       AND s.reason IN ('hard_bounce', 'complaint')
  ) THEN
    RETURN 'suppression_blocked';
  END IF;

  UPDATE public.marketing_sync_jobs
     SET first_provider_attempt_at = COALESCE(first_provider_attempt_at, p_attempted_at),
         updated_at = p_attempted_at
   WHERE job_id = p_job_id;
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.finish_marketing_sync_job(
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
  IF p_status NOT IN ('provider_accepted', 'retry_scheduled', 'failed_permanent', 'suppressed') THEN
    RAISE EXCEPTION 'invalid marketing sync finish status';
  END IF;
  IF p_status = 'retry_scheduled' AND p_next_attempt_at IS NULL THEN
    RAISE EXCEPTION 'retry requires next attempt';
  END IF;

  UPDATE public.marketing_sync_jobs
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

REVOKE ALL ON FUNCTION public.claim_marketing_sync_jobs(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_marketing_sync_job()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_marketing_sync_attempt(uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_marketing_sync_job(uuid, uuid, text, timestamptz, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketing_sync_jobs(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_marketing_sync_attempt(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_marketing_sync_job(uuid, uuid, text, timestamptz, text, text, timestamptz) TO service_role;
