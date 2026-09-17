-- Calendar-aware access for the free 7-Day Comeback Plan.
--
-- Each plan keeps one stable local start date and IANA time zone. Day N is
-- available on start_on + (N - 1), while prior-day completion remains enforced
-- by complete_plan_day_atomic. Existing plans retain their creation date in UTC
-- as a safe compatibility anchor until they are rebuilt.

ALTER TABLE public.lead_plans
  ADD COLUMN plan_time_zone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN plan_start_on date,
  ADD COLUMN plan_calendar_configured_at timestamptz;

UPDATE public.lead_plans
   SET plan_start_on = (created_at AT TIME ZONE 'UTC')::date
 WHERE plan_start_on IS NULL;

ALTER TABLE public.lead_plans
  ALTER COLUMN plan_start_on SET NOT NULL,
  ALTER COLUMN plan_start_on SET DEFAULT CURRENT_DATE;

CREATE OR REPLACE FUNCTION public.configure_lead_plan_calendar(
  p_lead_plan_id uuid,
  p_time_zone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_configured_at timestamptz;
BEGIN
  IF p_lead_plan_id IS NULL OR p_time_zone IS NULL OR length(p_time_zone) > 100
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN
    RETURN false;
  END IF;

  SELECT plan_calendar_configured_at INTO v_configured_at
    FROM public.lead_plans
   WHERE id = p_lead_plan_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Exact submission replays never move the plan's calendar anchor.
  IF v_configured_at IS NOT NULL THEN RETURN true; END IF;

  UPDATE public.lead_plans
     SET plan_time_zone = p_time_zone,
         plan_start_on = (now() AT TIME ZONE p_time_zone)::date,
         plan_calendar_configured_at = now(),
         updated_at = now()
   WHERE id = p_lead_plan_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.lead_plan_day_is_available(
  p_lead_plan_id uuid,
  p_plan_version_id uuid,
  p_day_number integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((now() AT TIME ZONE plan_time_zone)::date >=
                  plan_start_on + (p_day_number - 1), false)
    FROM public.lead_plans
   WHERE id = p_lead_plan_id
     AND plan_version_id = p_plan_version_id
     AND p_day_number BETWEEN 1 AND 7
$$;

REVOKE ALL ON FUNCTION public.configure_lead_plan_calendar(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_plan_day_is_available(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_lead_plan_calendar(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lead_plan_day_is_available(uuid, uuid, integer) TO service_role;
