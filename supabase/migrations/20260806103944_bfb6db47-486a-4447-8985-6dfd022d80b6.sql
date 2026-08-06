-- Stalled (stalled_v1) lifecycle foundation, Technical Specification 7.10.2 / DL-057.
--
-- 1. Shared logical-key uniqueness becomes a partial unique index so every job
--    type except `stalled` keeps exactly one logical job per plan version.
--    Stalled episode uniqueness rests on the already globally unique
--    `email_jobs.idempotency_key`, which IS the logical episode key
--    `stalled:{plan_version_id}:after_day:{required_day_number}:v1`.
-- 2. The two existing enqueue paths keep matching that index by carrying the
--    identical index predicate in their ON CONFLICT clauses. No other behavior
--    of Plan Ready, Start Day 1, Halfway, Plan Completed, or Final Rescue changes.
-- 3. The atomic completion boundary additionally maintains the Stalled candidate
--    lifecycle: one durable candidate per newly inserted required Day 1-6
--    completion, anchored to the persisted completion timestamp and eligible
--    exactly 48 hours later, superseding any earlier unsent candidate.

DROP INDEX IF EXISTS public.email_jobs_logical_key;

CREATE UNIQUE INDEX email_jobs_logical_key
  ON public.email_jobs (job_type, plan_version_id, job_version)
  WHERE job_type <> 'stalled';

-- ---------------------------------------------------------------------------
-- Start Day 1 enqueue trigger: ON CONFLICT predicate only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_start_day_1_for_plan_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ON CONFLICT (job_type, plan_version_id, job_version) WHERE job_type <> 'stalled' DO NOTHING
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
$function$;

-- ---------------------------------------------------------------------------
-- Atomic completion boundary: unchanged Halfway behavior plus the Stalled
-- candidate lifecycle.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_plan_day_atomic(p_lead_plan_id uuid, p_plan_version_id uuid, p_day_number smallint)
 RETURNS TABLE(required_completions integer, halfway_job_id uuid, halfway_queued boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan jsonb;
  v_required smallint[];
  v_completed_at timestamptz;
  v_inserted boolean := false;
  v_count integer;
  v_job_id uuid;
  v_stalled_job_id uuid;
BEGIN
  IF p_lead_plan_id IS NULL OR p_plan_version_id IS NULL OR p_day_number IS NULL THEN
    RETURN;
  END IF;

  -- Lock and validate the current plan version so a replaced plan can never
  -- gain a completion, a Halfway job, a Stalled candidate, or a queued event.
  SELECT plan_json INTO v_plan
    FROM public.lead_plans
   WHERE id = p_lead_plan_id
     AND plan_version_id = p_plan_version_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Required day numbers come only from the top-level plan_json.days
  -- assignments. A nested days[].optional Active Recovery session is never a
  -- required completion and never contributes a day number.
  SELECT array_agg(day_number ORDER BY day_number) INTO v_required
    FROM (
      SELECT COALESCE((d.value->>'day')::smallint, d.ordinality::smallint) AS day_number
        FROM jsonb_array_elements(COALESCE(v_plan->'days', '[]'::jsonb))
             WITH ORDINALITY AS d(value, ordinality)
    ) s;

  IF v_required IS NULL OR NOT (p_day_number = ANY(v_required)) THEN
    RETURN;
  END IF;

  -- Sequential top-level required progression, enforced in this transaction.
  IF EXISTS (
    SELECT 1
      FROM unnest(v_required) AS r(day_number)
     WHERE r.day_number < p_day_number
       AND NOT EXISTS (
         SELECT 1 FROM public.lead_plan_day_completions c
          WHERE c.lead_plan_id = p_lead_plan_id
            AND c.day_number = r.day_number
       )
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.lead_plan_day_completions (lead_plan_id, day_number)
  VALUES (p_lead_plan_id, p_day_number)
  ON CONFLICT (lead_plan_id, day_number) DO NOTHING
  RETURNING lead_plan_day_completions.completed_at INTO v_completed_at;

  v_inserted := v_completed_at IS NOT NULL;

  IF NOT v_inserted THEN
    SELECT c.completed_at INTO v_completed_at
      FROM public.lead_plan_day_completions c
     WHERE c.lead_plan_id = p_lead_plan_id
       AND c.day_number = p_day_number;
  END IF;

  SELECT count(*)::integer INTO v_count
    FROM public.lead_plan_day_completions c
   WHERE c.lead_plan_id = p_lead_plan_id
     AND c.day_number = ANY(v_required);

  -- Only a newly inserted required completion that moves the authoritative
  -- count from 3 to 4 creates the Halfway job. The persisted fourth completion
  -- timestamp is the single anchor for the job and its queued event.
  IF v_inserted AND v_count = 4 THEN
    INSERT INTO public.email_jobs (
      job_type,
      job_version,
      template_version,
      lead_plan_id,
      plan_version_id,
      idempotency_key,
      eligible_at,
      status,
      created_at,
      updated_at
    ) VALUES (
      'halfway',
      'v1',
      'halfway_v1',
      p_lead_plan_id,
      p_plan_version_id,
      'halfway:' || p_plan_version_id::text || ':v1',
      v_completed_at,
      'pending',
      v_completed_at,
      v_completed_at
    )
    ON CONFLICT (job_type, plan_version_id, job_version) WHERE job_type <> 'stalled' DO NOTHING
    RETURNING email_jobs.job_id INTO v_job_id;

    IF v_job_id IS NOT NULL THEN
      INSERT INTO public.canonical_events (
        event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
      ) VALUES (
        'email_halfway_queued', 'v1', p_lead_plan_id, p_plan_version_id, v_job_id, v_completed_at
      );
    END IF;
  END IF;

  -- Stalled candidate lifecycle (7.10.2).
  --
  -- Only a newly inserted required completion creates a candidate: a replay of
  -- an already-persisted completion, an optional Active Recovery session, a
  -- workout start, a visit, an open, or a click never creates or resets an
  -- episode. The final required day creates no candidate, so a completed plan
  -- can never enter a stall episode. The 48-hour eligibility is anchored to the
  -- persisted completion timestamp, so a retry can never move the horizon.
  IF v_inserted
     AND p_day_number >= 1
     AND p_day_number <= 6
     AND EXISTS (
       SELECT 1 FROM unnest(v_required) AS r(day_number) WHERE r.day_number > p_day_number
     )
  THEN
    -- Newer required progress supersedes any earlier unsent candidate. An
    -- already provider-accepted Stalled message is never touched, so a later
    -- episode always requires new required progress.
    WITH superseded AS (
      UPDATE public.email_jobs
         SET status = 'canceled',
             canceled_at = v_completed_at,
             claim_token = NULL,
             locked_at = NULL,
             lease_expires_at = NULL,
             next_attempt_at = NULL,
             updated_at = now()
       WHERE plan_version_id = p_plan_version_id
         AND job_type = 'stalled'
         AND status IN ('pending','processing','retry_scheduled')
      RETURNING job_id
    )
    INSERT INTO public.canonical_events (
      event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
    )
    SELECT 'email_stalled_canceled', 'v1', p_lead_plan_id, p_plan_version_id,
           superseded.job_id, v_completed_at
      FROM superseded;

    INSERT INTO public.email_jobs (
      job_type,
      job_version,
      template_version,
      lead_plan_id,
      plan_version_id,
      idempotency_key,
      eligible_at,
      status,
      created_at,
      updated_at
    ) VALUES (
      'stalled',
      'v1',
      'stalled_v1',
      p_lead_plan_id,
      p_plan_version_id,
      'stalled:' || p_plan_version_id::text || ':after_day:' || p_day_number::text || ':v1',
      v_completed_at + interval '48 hours',
      'pending',
      v_completed_at,
      v_completed_at
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING email_jobs.job_id INTO v_stalled_job_id;

    IF v_stalled_job_id IS NOT NULL THEN
      INSERT INTO public.canonical_events (
        event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
      ) VALUES (
        'email_stalled_queued', 'v1', p_lead_plan_id, p_plan_version_id,
        v_stalled_job_id, v_completed_at
      );
    END IF;
  END IF;

  RETURN QUERY SELECT v_count, v_job_id, v_job_id IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint)
  TO service_role;
