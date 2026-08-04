-- Authoritative, scanner-safe Day 1 start state.
--
-- A passive page load, return-link GET, prefetch, provider open, or provider
-- click never calls this function. The application invokes it only after an
-- authorized, deliberate Start Day 1 action (or a deliberate Day 1 completion).

CREATE TABLE public.lead_plan_day_starts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id) ON DELETE CASCADE,
  plan_version_id uuid NOT NULL,
  day_number smallint NOT NULL CONSTRAINT lead_plan_day_starts_day_one_chk CHECK (day_number = 1),
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_plan_day_starts_version_day_key UNIQUE (plan_version_id, day_number)
);

GRANT ALL ON public.lead_plan_day_starts TO service_role;

ALTER TABLE public.lead_plan_day_starts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages day starts"
ON public.lead_plan_day_starts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX lead_plan_day_starts_lead_plan_id_idx
  ON public.lead_plan_day_starts (lead_plan_id);

-- Defense in depth for the canonical activation event. The state-row insert
-- below is already idempotent, and this index also prevents event duplication
-- if the surrounding implementation is retried after a partial repair.
CREATE UNIQUE INDEX canonical_events_day_1_started_key
  ON public.canonical_events (plan_version_id)
  WHERE event_name = 'day_1_started';

CREATE OR REPLACE FUNCTION public.mark_day_1_started(
  p_lead_plan_id uuid,
  p_plan_version_id uuid
) RETURNS TABLE(
  started_at timestamptz,
  newly_started boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at timestamptz;
BEGIN
  IF p_lead_plan_id IS NULL OR p_plan_version_id IS NULL THEN
    RETURN;
  END IF;

  -- Lock and validate the current version so a reassessment cannot attach a
  -- start to stale plan content.
  PERFORM 1
    FROM public.lead_plans
   WHERE id = p_lead_plan_id
     AND plan_version_id = p_plan_version_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- A completed Day 1 cannot be started afterward. The completion action calls
  -- this boundary before it writes the completion when a start is still absent.
  IF EXISTS (
    SELECT 1
      FROM public.lead_plan_day_completions
     WHERE lead_plan_id = p_lead_plan_id
       AND day_number = 1
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.lead_plan_day_starts (
    lead_plan_id,
    plan_version_id,
    day_number
  ) VALUES (
    p_lead_plan_id,
    p_plan_version_id,
    1
  )
  ON CONFLICT (plan_version_id, day_number) DO NOTHING
  RETURNING lead_plan_day_starts.started_at INTO v_started_at;

  IF v_started_at IS NOT NULL THEN
    INSERT INTO public.canonical_events (
      event_name,
      event_version,
      lead_plan_id,
      plan_version_id,
      source,
      occurred_at
    ) VALUES (
      'day_1_started',
      'v1',
      p_lead_plan_id,
      p_plan_version_id,
      'explicit_app_action',
      v_started_at
    )
    ON CONFLICT DO NOTHING;

    RETURN QUERY SELECT v_started_at, true;
    RETURN;
  END IF;

  SELECT day_start.started_at
    INTO v_started_at
    FROM public.lead_plan_day_starts AS day_start
   WHERE day_start.plan_version_id = p_plan_version_id
     AND day_start.day_number = 1;

  IF v_started_at IS NOT NULL THEN
    RETURN QUERY SELECT v_started_at, false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_day_1_started(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_day_1_started(uuid, uuid)
  TO service_role;
