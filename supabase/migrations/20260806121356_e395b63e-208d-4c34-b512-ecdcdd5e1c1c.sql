-- Stalled repair checkpoint: forward-only corrective migration.
--
-- Adds the authoritative Final Rescue creation guard to
-- public.complete_plan_day_atomic. The synchronized function body from
-- 20260806103944 is preserved byte-for-byte except for the guard and its
-- directly related explanatory comment. Nothing else changes: Day 1-6
-- required behavior, Day 7 exclusion, persisted-completion anchoring,
-- 48-hour eligibility, prior unsent-candidate cancellation when the guard is
-- absent, Halfway behavior, Start Day 1 behavior, the partial unique index,
-- grants, RLS, and service-role boundaries are untouched.

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