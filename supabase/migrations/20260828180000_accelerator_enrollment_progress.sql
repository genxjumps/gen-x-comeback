-- Account-owned purchase, entitlement, and repeatable program-run foundation.
-- This migration remains unapplied. It creates no public enrollment, provider,
-- customer-migration, email, or browser-write path.

CREATE TABLE public.paid_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  product_code text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL CHECK (currency = upper(currency) AND length(currency) = 3),
  purchase_source text NOT NULL,
  source_reference text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('paid', 'refunded', 'disputed', 'canceled')),
  purchased_at timestamptz NOT NULL,
  refund_request_deadline_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_purchases_source_reference_unique UNIQUE (purchase_source, source_reference),
  CONSTRAINT paid_purchases_refund_window_check
    CHECK (refund_request_deadline_at = purchased_at + interval '7 days')
);

CREATE TABLE public.paid_product_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  purchase_id uuid NOT NULL REFERENCES public.paid_purchases(id) ON DELETE RESTRICT,
  product_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'revoked')),
  granted_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_product_entitlements_customer_product_unique UNIQUE (customer_id, product_code),
  CONSTRAINT paid_product_entitlements_purchase_product_unique UNIQUE (purchase_id, product_code),
  CONSTRAINT paid_product_entitlements_revocation_check CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

-- Each row is one historical trip through a program. Ownership with no run is
-- the customer-facing Not Started state.
CREATE TABLE public.paid_program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  entitlement_id uuid NOT NULL REFERENCES public.paid_product_entitlements(id) ON DELETE RESTRICT,
  product_code text NOT NULL,
  program_version text NOT NULL,
  program_snapshot jsonb NOT NULL,
  run_number integer NOT NULL CHECK (run_number > 0),
  status text NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'revoked')),
  started_at timestamptz NOT NULL,
  paused_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_program_enrollments_run_unique UNIQUE (entitlement_id, run_number),
  CONSTRAINT paid_program_enrollments_snapshot_check CHECK (
    program_snapshot->>'productCode' = product_code
    AND program_snapshot->>'programVersion' = program_version
    AND jsonb_typeof(program_snapshot->'days') = 'array'
    AND jsonb_array_length(program_snapshot->'days') > 0
  ),
  CONSTRAINT paid_program_enrollments_state_check CHECK (
    (status = 'active' AND paused_at IS NULL AND completed_at IS NULL AND revoked_at IS NULL)
    OR (status = 'paused' AND paused_at IS NOT NULL AND completed_at IS NULL AND revoked_at IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX paid_program_enrollments_one_active_per_customer_idx
  ON public.paid_program_enrollments (customer_id)
  WHERE status = 'active';

CREATE TABLE public.paid_program_day_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.paid_program_enrollments(id) ON DELETE CASCADE,
  program_version text NOT NULL,
  day_number smallint NOT NULL CHECK (day_number > 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_program_day_completions_unique UNIQUE (enrollment_id, day_number)
);

-- Retained only for the existing private proof. Checkpoint 4 replaces this
-- shape with the approved independent measurement history.
CREATE TABLE public.paid_program_weekly_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.paid_program_enrollments(id) ON DELETE CASCADE,
  program_version text NOT NULL,
  week_number smallint NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  weight_value numeric(7,2) NOT NULL CHECK (weight_value > 0),
  weight_unit text NOT NULL CHECK (weight_unit IN ('lb', 'kg')),
  waist_value numeric(7,2) NOT NULL CHECK (waist_value > 0),
  waist_unit text NOT NULL CHECK (waist_unit IN ('in', 'cm')),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_program_weekly_check_ins_unique UNIQUE (enrollment_id, week_number)
);

CREATE INDEX paid_purchases_customer_id_idx ON public.paid_purchases (customer_id);
CREATE INDEX paid_product_entitlements_customer_id_idx
  ON public.paid_product_entitlements (customer_id);
CREATE INDEX paid_program_enrollments_customer_id_idx
  ON public.paid_program_enrollments (customer_id, created_at DESC);
CREATE INDEX paid_program_day_completions_enrollment_id_idx
  ON public.paid_program_day_completions (enrollment_id, day_number);
CREATE INDEX paid_program_weekly_check_ins_enrollment_id_idx
  ON public.paid_program_weekly_check_ins (enrollment_id, week_number);

CREATE OR REPLACE FUNCTION public.protect_paid_program_enrollment_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.customer_id, NEW.entitlement_id, NEW.product_code, NEW.program_version,
      NEW.program_snapshot, NEW.run_number, NEW.started_at)
    IS DISTINCT FROM
     (OLD.customer_id, OLD.entitlement_id, OLD.product_code, OLD.program_version,
      OLD.program_snapshot, OLD.run_number, OLD.started_at)
  THEN
    RAISE EXCEPTION 'paid program run history is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_paid_program_enrollment_history_before_update
BEFORE UPDATE ON public.paid_program_enrollments
FOR EACH ROW EXECUTE FUNCTION public.protect_paid_program_enrollment_history();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'paid_purchases', 'paid_product_entitlements', 'paid_program_enrollments',
    'paid_program_day_completions', 'paid_program_weekly_check_ins'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'Service role manages ' || replace(t, '_', ' '), t
    );
  END LOOP;
END;
$$;

-- Trusted checkout code calls this only after independently verifying payment.
-- It records durable ownership and deliberately does not create or start a run.
CREATE OR REPLACE FUNCTION public.provision_accelerator_ownership(
  p_customer_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_purchase_source text,
  p_source_reference text,
  p_purchased_at timestamptz,
  p_product_code text,
  p_amount_cents integer,
  p_currency text
) RETURNS TABLE(
  outcome text, customer_id uuid, purchase_id uuid, entitlement_id uuid, replayed boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_purchase public.paid_purchases%ROWTYPE;
  v_entitlement_id uuid;
BEGIN
  IF p_customer_id IS NULL
    OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0
    OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_purchase_source IS NULL OR length(btrim(p_purchase_source)) = 0
    OR p_source_reference IS NULL OR length(btrim(p_source_reference)) = 0
    OR p_purchased_at IS NULL
    OR p_product_code <> 'accelerator_28'
    OR p_amount_cents <> 3700
    OR p_currency <> 'USD'
    OR NOT EXISTS (SELECT 1 FROM public.customer_accounts a WHERE a.id = p_customer_id)
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_purchase_source || chr(0) || p_source_reference, 1)
  );

  SELECT * INTO v_purchase FROM public.paid_purchases
   WHERE idempotency_key = p_idempotency_key FOR UPDATE;

  IF FOUND THEN
    IF v_purchase.request_fingerprint <> p_request_fingerprint
      OR v_purchase.customer_id <> p_customer_id
    THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
      RETURN;
    END IF;
    SELECT e.id INTO v_entitlement_id FROM public.paid_product_entitlements e
     WHERE e.customer_id = p_customer_id AND e.product_code = p_product_code;
    IF v_entitlement_id IS NULL THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'replayed'::text, p_customer_id, v_purchase.id, v_entitlement_id, true;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.paid_purchases
    WHERE purchase_source = p_purchase_source AND source_reference = p_source_reference)
  THEN
    RETURN QUERY SELECT 'conflict'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  INSERT INTO public.paid_purchases (
    customer_id, product_code, amount_cents, currency, purchase_source,
    source_reference, idempotency_key, request_fingerprint, status,
    purchased_at, refund_request_deadline_at
  ) VALUES (
    p_customer_id, p_product_code, p_amount_cents, p_currency, p_purchase_source,
    p_source_reference, p_idempotency_key, p_request_fingerprint, 'paid',
    p_purchased_at, p_purchased_at + interval '7 days'
  ) RETURNING * INTO v_purchase;

  INSERT INTO public.paid_product_entitlements (
    customer_id, purchase_id, product_code, status, granted_at
  ) VALUES (p_customer_id, v_purchase.id, p_product_code, 'active', p_purchased_at)
  ON CONFLICT (customer_id, product_code) DO UPDATE
    SET purchase_id = EXCLUDED.purchase_id, status = 'active',
        granted_at = EXCLUDED.granted_at, revoked_at = NULL, updated_at = now()
  RETURNING id INTO v_entitlement_id;

  RETURN QUERY SELECT 'created'::text, p_customer_id, v_purchase.id, v_entitlement_id, false;
END;
$$;

-- Starting is separate from buying. It creates a new run and atomically pauses
-- the account's currently active structured run.
CREATE OR REPLACE FUNCTION public.start_program_run_atomic(
  p_customer_id uuid,
  p_entitlement_id uuid,
  p_program_version text,
  p_program_snapshot jsonb
) RETURNS TABLE(
  outcome text, enrollment_id uuid, run_number integer, paused_enrollment_id uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entitlement public.paid_product_entitlements%ROWTYPE;
  v_run_number integer;
  v_enrollment_id uuid;
  v_paused_id uuid;
BEGIN
  IF p_customer_id IS NULL OR p_entitlement_id IS NULL
    OR p_program_version IS NULL OR length(btrim(p_program_version)) = 0
    OR p_program_snapshot IS NULL
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

  IF EXISTS (SELECT 1 FROM public.paid_program_enrollments
    WHERE entitlement_id = p_entitlement_id AND status IN ('active', 'paused'))
  THEN
    RETURN QUERY SELECT 'existing_unfinished_run'::text, NULL::uuid, NULL::integer, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.paid_program_enrollments
     SET status = 'paused', paused_at = now(), updated_at = now()
   WHERE customer_id = p_customer_id AND status = 'active'
  RETURNING id INTO v_paused_id;

  SELECT COALESCE(max(run_number), 0) + 1 INTO v_run_number
    FROM public.paid_program_enrollments WHERE entitlement_id = p_entitlement_id;

  INSERT INTO public.paid_program_enrollments (
    customer_id, entitlement_id, product_code, program_version,
    program_snapshot, run_number, status, started_at
  ) VALUES (
    p_customer_id, p_entitlement_id, v_entitlement.product_code, p_program_version,
    p_program_snapshot, v_run_number, 'active', now()
  ) RETURNING id INTO v_enrollment_id;

  RETURN QUERY SELECT 'started'::text, v_enrollment_id, v_run_number, v_paused_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_program_run_atomic(
  p_customer_id uuid, p_enrollment_id uuid
) RETURNS SETOF public.paid_program_enrollments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 2));
  RETURN QUERY UPDATE public.paid_program_enrollments
     SET status = 'paused', paused_at = now(), updated_at = now()
   WHERE id = p_enrollment_id AND customer_id = p_customer_id AND status = 'active'
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_program_run_atomic(
  p_customer_id uuid, p_enrollment_id uuid
) RETURNS TABLE(outcome text, enrollment_id uuid, paused_enrollment_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_paused_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 2));
  PERFORM 1 FROM public.paid_program_enrollments n
    JOIN public.paid_product_entitlements e ON e.id = n.entitlement_id
   WHERE n.id = p_enrollment_id AND n.customer_id = p_customer_id
     AND n.status = 'paused' AND e.status = 'active' FOR UPDATE OF n;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.paid_program_enrollments
     SET status = 'paused', paused_at = now(), updated_at = now()
   WHERE customer_id = p_customer_id AND status = 'active' AND id <> p_enrollment_id
  RETURNING id INTO v_paused_id;
  UPDATE public.paid_program_enrollments
     SET status = 'active', paused_at = NULL, updated_at = now()
   WHERE id = p_enrollment_id;
  RETURN QUERY SELECT 'resumed'::text, p_enrollment_id, v_paused_id;
END;
$$;

-- Checkpoint 3 will replace this progress function with next-day unlocking,
-- undo, missed-day, and video-view behavior. It remains sequential and locked.
CREATE OR REPLACE FUNCTION public.complete_accelerator_day_atomic(
  p_enrollment_id uuid, p_program_version text, p_day_number smallint
) RETURNS TABLE(completed_days smallint[], newly_completed boolean, program_completed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enrollment public.paid_program_enrollments%ROWTYPE;
  v_inserted_day smallint;
  v_completed smallint[];
BEGIN
  SELECT n.* INTO v_enrollment FROM public.paid_program_enrollments n
    JOIN public.paid_product_entitlements e ON e.id = n.entitlement_id
   WHERE n.id = p_enrollment_id AND n.program_version = p_program_version
     AND n.status IN ('active', 'completed') AND e.status = 'active' FOR UPDATE OF n;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_enrollment.program_snapshot->'days') AS d(value)
     WHERE (d.value->>'day')::smallint = p_day_number
  ) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM generate_series(1, p_day_number - 1) required(day_number)
    WHERE NOT EXISTS (SELECT 1 FROM public.paid_program_day_completions c
      WHERE c.enrollment_id = p_enrollment_id AND c.day_number = required.day_number))
  THEN RETURN; END IF;

  INSERT INTO public.paid_program_day_completions (enrollment_id, program_version, day_number)
  VALUES (p_enrollment_id, p_program_version, p_day_number)
  ON CONFLICT (enrollment_id, day_number) DO NOTHING RETURNING day_number INTO v_inserted_day;
  SELECT array_agg(day_number ORDER BY day_number) INTO v_completed
    FROM public.paid_program_day_completions WHERE enrollment_id = p_enrollment_id;
  IF cardinality(v_completed) = jsonb_array_length(v_enrollment.program_snapshot->'days')
    AND v_enrollment.status <> 'completed'
  THEN
    UPDATE public.paid_program_enrollments SET status = 'completed', paused_at = NULL,
      completed_at = now(), updated_at = now() WHERE id = p_enrollment_id;
  END IF;
  RETURN QUERY SELECT COALESCE(v_completed, ARRAY[]::smallint[]), v_inserted_day IS NOT NULL,
    cardinality(v_completed) = jsonb_array_length(v_enrollment.program_snapshot->'days');
END;
$$;

CREATE OR REPLACE FUNCTION public.save_accelerator_weekly_check_in_atomic(
  p_enrollment_id uuid, p_program_version text, p_week_number smallint,
  p_weight_value numeric, p_weight_unit text, p_waist_value numeric,
  p_waist_unit text, p_notes text
) RETURNS SETOF public.paid_program_weekly_check_ins
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_completed_count integer;
BEGIN
  IF p_week_number NOT BETWEEN 1 AND 4 OR p_weight_value <= 0
    OR p_weight_unit NOT IN ('lb', 'kg') OR p_waist_value <= 0
    OR p_waist_unit NOT IN ('in', 'cm') OR length(COALESCE(p_notes, '')) > 1000
  THEN RETURN; END IF;
  PERFORM 1 FROM public.paid_program_enrollments n
    JOIN public.paid_product_entitlements e ON e.id = n.entitlement_id
   WHERE n.id = p_enrollment_id AND n.program_version = p_program_version
     AND n.status IN ('active', 'completed') AND e.status = 'active' FOR UPDATE OF n;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*)::integer INTO v_completed_count FROM public.paid_program_day_completions
   WHERE enrollment_id = p_enrollment_id AND program_version = p_program_version;
  IF v_completed_count < ((p_week_number - 1) * 7) THEN RETURN; END IF;
  RETURN QUERY INSERT INTO public.paid_program_weekly_check_ins (
    enrollment_id, program_version, week_number, weight_value, weight_unit,
    waist_value, waist_unit, notes
  ) VALUES (
    p_enrollment_id, p_program_version, p_week_number, p_weight_value, p_weight_unit,
    p_waist_value, p_waist_unit, NULLIF(btrim(p_notes), '')
  ) ON CONFLICT (enrollment_id, week_number) DO UPDATE SET
    weight_value = EXCLUDED.weight_value, weight_unit = EXCLUDED.weight_unit,
    waist_value = EXCLUDED.waist_value, waist_unit = EXCLUDED.waist_unit,
    notes = EXCLUDED.notes, recorded_at = now(), updated_at = now()
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_paid_program_enrollment_history()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provision_accelerator_ownership(
  uuid, text, text, text, text, timestamptz, text, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_accelerator_ownership(
  uuid, text, text, text, text, timestamptz, text, integer, text
) TO service_role;
REVOKE ALL ON FUNCTION public.start_program_run_atomic(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_program_run_atomic(uuid, uuid, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.pause_program_run_atomic(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_program_run_atomic(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.resume_program_run_atomic(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resume_program_run_atomic(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.complete_accelerator_day_atomic(uuid, text, smallint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_accelerator_day_atomic(uuid, text, smallint) TO service_role;
REVOKE ALL ON FUNCTION public.save_accelerator_weekly_check_in_atomic(
  uuid, text, smallint, numeric, text, numeric, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_accelerator_weekly_check_in_atomic(
  uuid, text, smallint, numeric, text, numeric, text, text
) TO service_role;
