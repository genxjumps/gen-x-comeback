-- Plan Completed lifecycle checkpoint: forward-only migration.
--
-- Replaces one authoritative function body to add the Plan Completed job at the
-- final required-completion boundary, its single queued event, and the
-- same-transaction cancellation of every unsent lower-priority lifecycle job for
-- that plan version. Everything else in the function is preserved: signature,
-- return shape, SECURITY DEFINER, search_path, locking, sequential progression,
-- Halfway behavior, Stalled behavior, Final Rescue behavior, and grants.
--
-- No backfill. No provider send. No schema change.

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
  v_plan_completed_job_id uuid;
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

  -- Plan Completed boundary.
  --
  -- Only a newly inserted required top-level completion that makes every
  -- required top-level plan day complete reaches this block. A replayed
  -- completion, a nested optional Active Recovery session, a workout start, a
  -- visit, an open, a click, or a return-link exchange never creates a Plan
  -- Completed job, never emits a queued event, and never cancels anything.
  --
  -- Completion is determined only from persisted required-day completions, never
  -- from elapsed calendar time or client input. A shorter plan completes on its
  -- own last required day: a nested optional W07 session never blocks it and
  -- never creates a boundary.
  --
  -- Exactly one job per plan version, immediately eligible at the persisted
  -- final required completion timestamp. No existing plan version is backfilled.
  IF v_inserted AND v_count >= COALESCE(array_length(v_required, 1), 0) THEN
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
      'plan_completed',
      'v1',
      'plan_completed_v1',
      p_lead_plan_id,
      p_plan_version_id,
      'plan_completed:' || p_plan_version_id::text || ':v1',
      v_completed_at,
      'pending',
      v_completed_at,
      v_completed_at
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING email_jobs.job_id INTO v_plan_completed_job_id;

    -- Exactly one queued event, only when the Plan Completed row was actually
    -- inserted in this transaction.
    IF v_plan_completed_job_id IS NOT NULL THEN
      INSERT INTO public.canonical_events (
        event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
      ) VALUES (
        'email_plan_completed_queued', 'v1', p_lead_plan_id, p_plan_version_id,
        v_plan_completed_job_id, v_completed_at
      );
    END IF;

    -- Plan Completed outranks every other lifecycle message, so every unsent
    -- lower-priority job for this plan version is closed in this same
    -- authoritative transaction. Unsent means pending, processing, or
    -- retry_scheduled. Claim and lease fields are released so a worker that
    -- claimed a job but has not yet attempted a provider send can never send
    -- after this authoritative decision. Already provider-accepted jobs and
    -- their history are never touched.
    WITH closed AS (
      UPDATE public.email_jobs
         SET status = 'canceled',
             canceled_at = v_completed_at,
             claim_token = NULL,
             locked_at = NULL,
             lease_expires_at = NULL,
             next_attempt_at = NULL,
             updated_at = now()
       WHERE plan_version_id = p_plan_version_id
         AND job_type IN ('start_day_1','halfway','stalled','final_rescue')
         AND provider_accepted_at IS NULL
         AND status IN ('pending','processing','retry_scheduled')
      RETURNING job_id, job_type
    )
    INSERT INTO public.canonical_events (
      event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
    )
    SELECT 'email_' || closed.job_type || '_canceled', 'v1', p_lead_plan_id, p_plan_version_id,
           closed.job_id, v_completed_at
      FROM closed;
  END IF;

  -- Final Rescue re-anchoring and closure.
  --
  -- Only a newly inserted required top-level completion reaches this block: a
  -- replayed completion, an optional nested Active Recovery session, a workout
  -- start, a visit, an open, a click, or a return-link exchange never moves or
  -- closes the Final Rescue horizon.
  --
  -- While the plan is still incomplete the single unsent Final Rescue job for
  -- this plan version is re-anchored to the persisted completed_at plus 5 days.
  -- When this completion finishes the last required day, the same unsent job is
  -- canceled in this authoritative transaction. In both cases any in-flight
  -- lease is released, so a worker that claimed the job but has not yet
  -- attempted a provider send can never send after the authoritative decision.
  --
  -- On the completion boundary the Plan Completed block above has already closed
  -- the same unsent job with the same canonical event, so this statement finds
  -- no rows and no duplicate event is ever written.
  IF v_inserted THEN
    IF v_count >= COALESCE(array_length(v_required, 1), 0) THEN
      WITH closed AS (
        UPDATE public.email_jobs
           SET status = 'canceled',
               canceled_at = v_completed_at,
               claim_token = NULL,
               locked_at = NULL,
               lease_expires_at = NULL,
               next_attempt_at = NULL,
               updated_at = now()
         WHERE plan_version_id = p_plan_version_id
           AND job_type = 'final_rescue'
           AND job_version = 'v1'
           AND provider_accepted_at IS NULL
           AND status IN ('pending','processing','retry_scheduled')
        RETURNING job_id
      )
      INSERT INTO public.canonical_events (
        event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
      )
      SELECT 'email_final_rescue_canceled', 'v1', p_lead_plan_id, p_plan_version_id,
             closed.job_id, v_completed_at
        FROM closed;
    ELSE
      UPDATE public.email_jobs
         SET eligible_at = v_completed_at + interval '5 days',
             status = 'pending',
             next_attempt_at = NULL,
             claim_token = NULL,
             locked_at = NULL,
             lease_expires_at = NULL,
             updated_at = now()
       WHERE plan_version_id = p_plan_version_id
         AND job_type = 'final_rescue'
         AND job_version = 'v1'
         AND provider_accepted_at IS NULL
         AND status IN ('pending','processing','retry_scheduled');
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
     -- Final Rescue closure is authoritative at the creation boundary: once a
     -- Final Rescue message has been provider accepted for this plan version,
     -- no later Stalled candidate is created, no earlier unsent candidate is
     -- canceled, and no email_stalled_queued event is emitted. The newly
     -- required Day 1-6 completion itself still persists normally above.
     AND NOT EXISTS (
       SELECT 1
         FROM public.email_jobs final_rescue_job
        WHERE final_rescue_job.plan_version_id = p_plan_version_id
          AND final_rescue_job.job_type = 'final_rescue'
          AND final_rescue_job.provider_accepted_at IS NOT NULL
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