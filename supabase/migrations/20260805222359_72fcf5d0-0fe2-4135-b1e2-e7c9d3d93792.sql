-- Halfway (halfway_v1) atomic completion boundary.
--
-- One all-or-nothing server-authoritative step guarantees the 3-to-4 required
-- completion transition, the inactivity-clock reset, the milestone event, and
-- exactly one Halfway outbox job per plan version. No provider call happens here.

-- Defense in depth for the milestone event: at most one per plan version.
CREATE UNIQUE INDEX IF NOT EXISTS canonical_events_plan_halfway_reached_key
  ON public.canonical_events (plan_version_id)
  WHERE event_name = 'plan_halfway_reached';

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
  v_now timestamptz := now();
  v_before integer;
  v_after integer;
  v_job_id uuid;
BEGIN
  IF p_lead_plan_id IS NULL OR p_plan_version_id IS NULL OR p_day_number IS NULL THEN
    RETURN;
  END IF;

  -- Lock and validate the current plan version so a reassessment can never
  -- attach a completion or a Halfway job to replaced plan content.
  PERFORM 1
    FROM public.lead_plans
   WHERE id = p_lead_plan_id
     AND plan_version_id = p_plan_version_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_before
    FROM public.lead_plan_day_completions
   WHERE lead_plan_id = p_lead_plan_id;

  INSERT INTO public.lead_plan_day_completions (lead_plan_id, day_number)
  VALUES (p_lead_plan_id, p_day_number)
  ON CONFLICT (lead_plan_id, day_number) DO NOTHING;

  SELECT count(*)::integer INTO v_after
    FROM public.lead_plan_day_completions
   WHERE lead_plan_id = p_lead_plan_id;

  -- Exactly the 3-to-4 required-completion transition, inside this transaction.
  IF v_before = 3 AND v_after = 4 THEN
    -- The 4th completion is fresh activity: reset the inactivity clock.
    UPDATE public.lead_plans
       SET email_last_engaged_at = v_now,
           updated_at = v_now
     WHERE id = p_lead_plan_id;

    INSERT INTO public.canonical_events (
      event_name, event_version, lead_plan_id, plan_version_id, source, occurred_at
    ) VALUES (
      'plan_halfway_reached', 'v1', p_lead_plan_id, p_plan_version_id,
      'explicit_app_action', v_now
    )
    ON CONFLICT DO NOTHING;

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
      v_now,
      'pending',
      v_now,
      v_now
    )
    ON CONFLICT (job_type, plan_version_id, job_version) DO NOTHING
    RETURNING email_jobs.job_id INTO v_job_id;

    IF v_job_id IS NOT NULL THEN
      INSERT INTO public.canonical_events (
        event_name, event_version, lead_plan_id, plan_version_id, job_id, occurred_at
      ) VALUES (
        'email_halfway_queued', 'v1', p_lead_plan_id, p_plan_version_id, v_job_id, v_now
      );
    END IF;
  END IF;

  RETURN QUERY SELECT v_after, v_job_id, v_job_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint)
  TO service_role;