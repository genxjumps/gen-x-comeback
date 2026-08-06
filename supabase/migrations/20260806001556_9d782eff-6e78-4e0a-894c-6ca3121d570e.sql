-- Start Day 1 (start_day_1_v1) durable job-creation foundation.
--
-- A Plan Ready job is created inside commit_plan_version for every newly
-- committed plan version. This trigger uses that same transaction boundary to
-- create the corresponding Start Day 1 job and its queued event. The logical
-- email_jobs key makes the operation idempotent.

CREATE OR REPLACE FUNCTION public.enqueue_start_day_1_for_plan_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_submission_id uuid;
BEGIN
  IF NEW.job_type <> 'plan_ready' OR NEW.job_version <> 'v1' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.email_jobs (
    job_type,
    job_version,
    template_version,
    lead_plan_id,
    plan_version_id,
    source_event_id,
    idempotency_key,
    eligible_at,
    status,
    created_at,
    updated_at
  ) VALUES (
    'start_day_1',
    'v1',
    'start_day_1_v1',
    NEW.lead_plan_id,
    NEW.plan_version_id,
    NEW.source_event_id,
    'start_day_1:' || NEW.plan_version_id::text || ':v1',
    NEW.created_at + interval '24 hours',
    'pending',
    NEW.created_at,
    NEW.created_at
  )
  ON CONFLICT (job_type, plan_version_id, job_version) DO NOTHING
  RETURNING job_id INTO v_job_id;

  -- Only the transaction that created the logical job records its queued event.
  IF v_job_id IS NOT NULL THEN
    SELECT submission_id
      INTO v_submission_id
      FROM public.canonical_events
     WHERE event_id = NEW.source_event_id;

    INSERT INTO public.canonical_events (
      event_name,
      event_version,
      lead_plan_id,
      plan_version_id,
      submission_id,
      job_id,
      occurred_at
    ) VALUES (
      'email_start_day_1_queued',
      'v1',
      NEW.lead_plan_id,
      NEW.plan_version_id,
      v_submission_id,
      v_job_id,
      NEW.created_at
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_start_day_1_after_plan_ready ON public.email_jobs;
CREATE TRIGGER enqueue_start_day_1_after_plan_ready
AFTER INSERT ON public.email_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_start_day_1_for_plan_ready();

-- Existing current plan versions predate this trigger. Give each one the same
-- durable job, based on its Plan Ready creation time, without reviving replaced
-- plan versions or duplicating a job that is already present.
WITH inserted_jobs AS (
  INSERT INTO public.email_jobs (
    job_type,
    job_version,
    template_version,
    lead_plan_id,
    plan_version_id,
    source_event_id,
    idempotency_key,
    eligible_at,
    status,
    created_at,
    updated_at
  )
  SELECT
    'start_day_1',
    'v1',
    'start_day_1_v1',
    plan_ready.lead_plan_id,
    plan_ready.plan_version_id,
    plan_ready.source_event_id,
    'start_day_1:' || plan_ready.plan_version_id::text || ':v1',
    plan_ready.created_at + interval '24 hours',
    'pending',
    plan_ready.created_at,
    plan_ready.created_at
  FROM public.email_jobs AS plan_ready
  JOIN public.lead_plans AS lead
    ON lead.id = plan_ready.lead_plan_id
   AND lead.plan_version_id = plan_ready.plan_version_id
  WHERE plan_ready.job_type = 'plan_ready'
    AND plan_ready.job_version = 'v1'
  ON CONFLICT (job_type, plan_version_id, job_version) DO NOTHING
  RETURNING job_id, lead_plan_id, plan_version_id, source_event_id, created_at
)
INSERT INTO public.canonical_events (
  event_name,
  event_version,
  lead_plan_id,
  plan_version_id,
  submission_id,
  job_id,
  occurred_at
)
SELECT
  'email_start_day_1_queued',
  'v1',
  job.lead_plan_id,
  job.plan_version_id,
  source.submission_id,
  job.job_id,
  job.created_at
FROM inserted_jobs AS job
LEFT JOIN public.canonical_events AS source
  ON source.event_id = job.source_event_id;

REVOKE ALL ON FUNCTION public.enqueue_start_day_1_for_plan_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_start_day_1_for_plan_ready() TO service_role;