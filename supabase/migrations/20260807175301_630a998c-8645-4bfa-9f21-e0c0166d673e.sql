-- 1. Independent consent state columns.
ALTER TABLE public.lead_plans
  ADD COLUMN IF NOT EXISTS plan_email_consent_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_email_consent_source text,
  ADD COLUMN IF NOT EXISTS plan_email_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_email_unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_source text,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

-- 2. One normalized email is exactly one identity.
CREATE UNIQUE INDEX IF NOT EXISTS lead_plans_email_normalized_key
  ON public.lead_plans (email_normalized);

-- 3. Pre-production test backfill. Every existing identity is a Todd-controlled
-- test identity, so both consents are activated with an explicit test source
-- and migration-time timestamps. Suppression columns and rows are untouched.
UPDATE public.lead_plans SET
  plan_email_consent_active = true,
  plan_email_consent_source = 'pre_production_test_backfill',
  plan_email_consent_at = now(),
  plan_email_unsubscribed_at = NULL,
  marketing_consent_active = true,
  marketing_consent_source = 'pre_production_test_backfill',
  marketing_consent_at = now(),
  marketing_unsubscribed_at = NULL,
  updated_at = now();

-- 4. Contract constraints (added after the backfill so they validate cleanly).
ALTER TABLE public.lead_plans
  DROP CONSTRAINT IF EXISTS lead_plans_plan_consent_source_chk,
  DROP CONSTRAINT IF EXISTS lead_plans_marketing_consent_source_chk,
  DROP CONSTRAINT IF EXISTS lead_plans_plan_consent_active_chk,
  DROP CONSTRAINT IF EXISTS lead_plans_marketing_consent_active_chk;

ALTER TABLE public.lead_plans
  ADD CONSTRAINT lead_plans_plan_consent_source_chk CHECK (
    plan_email_consent_source IS NULL
    OR plan_email_consent_source IN ('plan_signup','plan_recovery','plan_preferences','pre_production_test_backfill')
  ),
  ADD CONSTRAINT lead_plans_marketing_consent_source_chk CHECK (
    marketing_consent_source IS NULL
    OR marketing_consent_source IN ('plan_signup','pre_production_test_backfill')
  ),
  ADD CONSTRAINT lead_plans_plan_consent_active_chk CHECK (
    NOT plan_email_consent_active
    OR (plan_email_consent_at IS NOT NULL AND plan_email_consent_source IS NOT NULL)
  ),
  ADD CONSTRAINT lead_plans_marketing_consent_active_chk CHECK (
    NOT marketing_consent_active
    OR (marketing_consent_at IS NOT NULL AND marketing_consent_source IS NOT NULL)
  );

-- 5. New 7-Day Plan signup explicitly activates BOTH consent states.
CREATE OR REPLACE FUNCTION public.apply_signup_consent_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.plan_email_consent_active := true;
  NEW.plan_email_consent_source := 'plan_signup';
  NEW.plan_email_consent_at := now();
  NEW.plan_email_unsubscribed_at := NULL;
  NEW.marketing_consent_active := true;
  NEW.marketing_consent_source := 'plan_signup';
  NEW.marketing_consent_at := now();
  NEW.marketing_unsubscribed_at := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS apply_signup_consent_state_before_insert ON public.lead_plans;
CREATE TRIGGER apply_signup_consent_state_before_insert
  BEFORE INSERT ON public.lead_plans
  FOR EACH ROW EXECUTE FUNCTION public.apply_signup_consent_state();

-- 6. Shared authoritative closure of every unsent proactive lifecycle job.
-- Recovery is transactional and is never closed here.
CREATE OR REPLACE FUNCTION public.cancel_unsent_proactive_jobs(
  p_lead_plan_id uuid,
  p_at timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer := 0;
BEGIN
  WITH closed AS (
    UPDATE public.email_jobs
       SET status = 'canceled',
           canceled_at = p_at,
           claim_token = NULL,
           locked_at = NULL,
           lease_expires_at = NULL,
           next_attempt_at = NULL,
           updated_at = now()
     WHERE lead_plan_id = p_lead_plan_id
       AND job_type IN ('plan_ready','start_day_1','halfway','stalled','final_rescue','plan_completed')
       AND provider_accepted_at IS NULL
       AND status IN ('pending','processing','retry_scheduled')
    RETURNING job_id, job_type, plan_version_id
  ), ins AS (
    INSERT INTO public.canonical_events (
      event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
    )
    SELECT 'email_' || closed.job_type || '_canceled', 'v1', p_lead_plan_id,
           closed.plan_version_id, closed.job_id, p_at
      FROM closed
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM ins;
  RETURN v_count;
END $$;

-- 7. Authoritative Plan-email consent transition. Marketing consent is never
-- read or written here.
CREATE OR REPLACE FUNCTION public.set_plan_email_consent(
  p_lead_plan_id uuid,
  p_active boolean,
  p_source text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_active boolean;
  v_now timestamptz := now();
BEGIN
  IF p_lead_plan_id IS NULL THEN RETURN false; END IF;

  SELECT plan_email_consent_active INTO v_active
    FROM public.lead_plans WHERE id = p_lead_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_active THEN
    -- Already-active consent is never refreshed and cancels nothing.
    IF v_active THEN RETURN false; END IF;

    UPDATE public.lead_plans
       SET plan_email_consent_active = true,
           plan_email_consent_source = p_source,
           plan_email_consent_at = v_now,
           plan_email_unsubscribed_at = NULL,
           updated_at = v_now
     WHERE id = p_lead_plan_id;

    -- Every proactive job created before this new consent boundary is closed
    -- permanently, so nothing from before re-consent can resurface.
    PERFORM public.cancel_unsent_proactive_jobs(p_lead_plan_id, v_now);

    INSERT INTO public.canonical_events (event_name, event_version, lead_plan_id, source, occurred_at)
    VALUES ('plan_email_consent_activated', 'v1', p_lead_plan_id, p_source, v_now);
    RETURN true;
  END IF;

  IF NOT v_active THEN RETURN false; END IF;

  UPDATE public.lead_plans
     SET plan_email_consent_active = false,
         plan_email_unsubscribed_at = v_now,
         updated_at = v_now
   WHERE id = p_lead_plan_id;

  PERFORM public.cancel_unsent_proactive_jobs(p_lead_plan_id, v_now);

  INSERT INTO public.canonical_events (event_name, event_version, lead_plan_id, source, occurred_at)
  VALUES ('plan_email_consent_withdrawn', 'v1', p_lead_plan_id, p_source, v_now);
  RETURN true;
END $$;

-- 8. Recovery: atomically re-consents Plan email when inactive, never touches
-- marketing consent, and still queues the requested transactional Recovery job.
CREATE OR REPLACE FUNCTION public.request_plan_recovery(p_email_normalized text, p_request_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead public.lead_plans;
  v_job_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_email_normalized IS NULL OR length(p_email_normalized) = 0
     OR p_request_id IS NULL OR length(p_request_id) = 0 THEN
    RETURN;
  END IF;

  SELECT * INTO v_lead
    FROM public.lead_plans
   WHERE email_normalized = p_email_normalized
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Inactive-to-active only. An already-active Plan consent is not refreshed,
  -- no lifecycle job is canceled, and the lifecycle is not restarted. Marketing
  -- consent is never read or written, so a withdrawn marketing consent can
  -- never be reactivated by Recovery.
  IF NOT v_lead.plan_email_consent_active THEN
    PERFORM public.set_plan_email_consent(v_lead.id, true, 'plan_recovery');
  END IF;

  -- Recovery is on-demand transactional product access. It never cancels,
  -- defers, or reprioritizes any proactive lifecycle job and consumes no
  -- lifecycle gap or cap.
  INSERT INTO public.email_jobs (
    job_type, job_version, template_version, lead_plan_id, plan_version_id,
    idempotency_key, eligible_at, status, created_at, updated_at
  ) VALUES (
    'recovery', 'v1', 'recovery_v1', v_lead.id, v_lead.plan_version_id,
    'recovery:' || v_lead.plan_version_id::text || ':' || p_request_id || ':v1',
    v_now, 'pending', v_now, v_now
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING email_jobs.job_id INTO v_job_id;

  IF v_job_id IS NOT NULL THEN
    INSERT INTO public.canonical_events (
      event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
    ) VALUES (
      'email_recovery_queued', 'v1', v_lead.id, v_lead.plan_version_id, v_job_id, v_now
    );
  END IF;
END $$;

-- 9. Pre-production safety cleanup: cancel every pre-migration nonterminal job
-- of every email type so no stale test email can escape later. Completed jobs,
-- delivery evidence, events, reconciliations, and contacts are preserved.
WITH closed AS (
  UPDATE public.email_jobs
     SET status = 'canceled',
         canceled_at = now(),
         claim_token = NULL,
         locked_at = NULL,
         lease_expires_at = NULL,
         next_attempt_at = NULL,
         updated_at = now()
   WHERE status IN ('pending','processing','retry_scheduled')
  RETURNING job_id, job_type, lead_plan_id, plan_version_id
)
INSERT INTO public.canonical_events (
  event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
)
SELECT 'email_' || closed.job_type || '_canceled', 'v1', closed.lead_plan_id,
       closed.plan_version_id, closed.job_id, now()
  FROM closed;

REVOKE ALL ON FUNCTION public.cancel_unsent_proactive_jobs(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_plan_email_consent(uuid, boolean, text) FROM PUBLIC;