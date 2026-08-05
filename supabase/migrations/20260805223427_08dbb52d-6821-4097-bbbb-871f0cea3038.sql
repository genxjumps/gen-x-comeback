DROP INDEX IF EXISTS public.canonical_events_plan_halfway_reached_key;

CREATE OR REPLACE FUNCTION public.complete_plan_day_atomic(
  p_lead_plan_id uuid,
  p_plan_version_id uuid,
  p_day_number smallint
) RETURNS TABLE(
  required_completions integer,
  halfway_job_id uuid,
  halfway_queued boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan jsonb;
  v_required smallint[];
  v_completed_at timestamptz;
  v_inserted boolean := false;
  v_count integer;
  v_job_id uuid;
BEGIN
  IF p_lead_plan_id IS NULL OR p_plan_version_id IS NULL OR p_day_number IS NULL THEN
    RETURN;
  END IF;

  -- Lock and validate the current plan version so a replaced plan can never
  -- gain a completion, a Halfway job, or a queued event.
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
    ON CONFLICT (job_type, plan_version_id, job_version) DO NOTHING
    RETURNING email_jobs.job_id INTO v_job_id;

    IF v_job_id IS NOT NULL THEN
      INSERT INTO public.canonical_events (
        event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
      ) VALUES (
        'email_halfway_queued', 'v1', p_lead_plan_id, p_plan_version_id, v_job_id, v_completed_at
      );
    END IF;
  END IF;

  RETURN QUERY SELECT v_count, v_job_id, v_job_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint)
  TO service_role;