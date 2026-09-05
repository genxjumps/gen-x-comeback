-- Qualify the enrollment run number inside the table-returning function.
-- The unqualified name conflicts with the function's run_number output field
-- and causes every first-run attempt to roll back before enrollment creation.

CREATE OR REPLACE FUNCTION public.start_program_run_atomic(
  p_customer_id uuid,
  p_entitlement_id uuid,
  p_program_version text,
  p_program_snapshot jsonb,
  p_customer_time_zone text
) RETURNS TABLE(
  outcome text, enrollment_id uuid, run_number integer,
  paused_enrollment_id uuid, paused_lead_plan_id uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entitlement public.paid_product_entitlements%ROWTYPE;
  v_run_number integer;
  v_enrollment_id uuid;
  v_paused_id uuid;
  v_paused_lead_plan_id uuid;
BEGIN
  IF p_customer_id IS NULL OR p_entitlement_id IS NULL
    OR p_program_version IS NULL OR length(btrim(p_program_version)) = 0
    OR p_program_snapshot IS NULL
    OR p_customer_time_zone IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_customer_time_zone)
  THEN RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 2));
  SELECT * INTO v_entitlement FROM public.paid_product_entitlements
   WHERE id = p_entitlement_id AND customer_id = p_customer_id AND status = 'active'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_program_snapshot->>'productCode' <> v_entitlement.product_code
    OR p_program_snapshot->>'programVersion' <> p_program_version
    OR jsonb_typeof(p_program_snapshot->'days') <> 'array'
    OR jsonb_array_length(p_program_snapshot->'days') = 0
  THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.paid_program_enrollments enrollment
    WHERE enrollment.entitlement_id = p_entitlement_id
      AND enrollment.status IN ('active', 'paused'))
  THEN
    RETURN QUERY SELECT 'existing_unfinished_run'::text, NULL::uuid, NULL::integer,
      NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT active.lead_plan_id INTO v_paused_lead_plan_id
    FROM public.customer_active_programs active
   WHERE active.customer_id = p_customer_id AND active.program_kind = 'lead_plan'
   FOR UPDATE;

  UPDATE public.paid_program_enrollments enrollment
     SET status = 'paused', paused_at = now(), updated_at = now()
   WHERE enrollment.customer_id = p_customer_id AND enrollment.status = 'active'
  RETURNING enrollment.id INTO v_paused_id;

  SELECT COALESCE(max(enrollment.run_number), 0) + 1 INTO v_run_number
    FROM public.paid_program_enrollments enrollment
   WHERE enrollment.entitlement_id = p_entitlement_id;

  INSERT INTO public.paid_program_enrollments (
    customer_id, entitlement_id, product_code, program_version,
    program_snapshot, run_number, customer_time_zone, status, started_at
  ) VALUES (
    p_customer_id, p_entitlement_id, v_entitlement.product_code, p_program_version,
    p_program_snapshot, v_run_number, p_customer_time_zone, 'active', now()
  ) RETURNING id INTO v_enrollment_id;

  INSERT INTO public.customer_active_programs (
    customer_id, program_kind, lead_plan_id, paid_enrollment_id
  ) VALUES (p_customer_id, 'paid_run', NULL, v_enrollment_id)
  ON CONFLICT (customer_id) DO UPDATE SET
    program_kind = 'paid_run', lead_plan_id = NULL,
    paid_enrollment_id = EXCLUDED.paid_enrollment_id,
    activated_at = now(), updated_at = now();

  RETURN QUERY SELECT 'started'::text, v_enrollment_id, v_run_number,
    v_paused_id, v_paused_lead_plan_id;
END;
$$;

