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
  customer_time_zone text NOT NULL,
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
  CONSTRAINT paid_program_enrollments_time_zone_check CHECK (
    customer_time_zone = btrim(customer_time_zone)
    AND length(customer_time_zone) BETWEEN 1 AND 100
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
  undo_until timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_program_day_completions_unique UNIQUE (enrollment_id, day_number),
  CONSTRAINT paid_program_day_completions_undo_window_check CHECK (
    undo_until = completed_at + interval '10 minutes'
  )
);

-- Viewing a program video and completing its day are deliberately independent.
-- Replays update this compact fact without changing assignment progress.
CREATE TABLE public.paid_program_video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.paid_program_enrollments(id) ON DELETE CASCADE,
  program_version text NOT NULL,
  day_number smallint NOT NULL CHECK (day_number > 0),
  media_key text NOT NULL CHECK (
    media_key = btrim(media_key) AND length(media_key) BETWEEN 1 AND 200
  ),
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  view_count integer NOT NULL DEFAULT 1 CHECK (view_count > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_program_video_views_unique UNIQUE (enrollment_id, day_number, media_key),
  CONSTRAINT paid_program_video_views_time_check CHECK (last_viewed_at >= first_viewed_at)
);

-- One small pointer coordinates free and paid structured programs. Removing or
-- replacing this pointer never deletes either program's history.
CREATE TABLE public.customer_active_programs (
  customer_id uuid PRIMARY KEY REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  program_kind text NOT NULL CHECK (program_kind IN ('lead_plan', 'paid_run')),
  lead_plan_id uuid UNIQUE REFERENCES public.lead_plans(id) ON DELETE RESTRICT,
  paid_enrollment_id uuid UNIQUE REFERENCES public.paid_program_enrollments(id) ON DELETE RESTRICT,
  activated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_active_programs_target_check CHECK (
    (program_kind = 'lead_plan' AND lead_plan_id IS NOT NULL AND paid_enrollment_id IS NULL)
    OR (program_kind = 'paid_run' AND paid_enrollment_id IS NOT NULL AND lead_plan_id IS NULL)
  )
);

-- Weight and waist are independent logical entries. The current row powers the
-- customer view; append-only revisions preserve corrections and removals.
CREATE TABLE public.customer_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  enrollment_id uuid REFERENCES public.paid_program_enrollments(id) ON DELETE RESTRICT,
  measurement_kind text NOT NULL CHECK (measurement_kind IN ('weight', 'waist')),
  value numeric(7,2) NOT NULL CHECK (value > 0),
  unit text NOT NULL CHECK (
    (measurement_kind = 'weight' AND unit IN ('lb', 'kg'))
    OR (measurement_kind = 'waist' AND unit IN ('in', 'cm'))
  ),
  measurement_context text NOT NULL CHECK (
    measurement_context IN ('general', 'starting', 'progress', 'final')
  ),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  measured_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_measurements_context_check CHECK (
    (measurement_context = 'general' AND enrollment_id IS NULL)
    OR (measurement_context IN ('starting', 'progress', 'final') AND enrollment_id IS NOT NULL)
  ),
  CONSTRAINT customer_measurements_removal_check CHECK (
    (status = 'active' AND removed_at IS NULL)
    OR (status = 'removed' AND removed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX customer_measurements_one_run_boundary_value_idx
  ON public.customer_measurements (enrollment_id, measurement_kind, measurement_context)
  WHERE status = 'active' AND measurement_context IN ('starting', 'final');

CREATE TABLE public.customer_measurement_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.customer_measurements(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  action text NOT NULL CHECK (action IN ('created', 'corrected', 'removed')),
  value numeric(7,2) NOT NULL CHECK (value > 0),
  unit text NOT NULL CHECK (unit IN ('lb', 'kg', 'in', 'cm')),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  measured_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_measurement_revisions_unique UNIQUE (measurement_id, revision)
);

CREATE INDEX paid_purchases_customer_id_idx ON public.paid_purchases (customer_id);
CREATE INDEX paid_product_entitlements_customer_id_idx
  ON public.paid_product_entitlements (customer_id);
CREATE INDEX paid_program_enrollments_customer_id_idx
  ON public.paid_program_enrollments (customer_id, created_at DESC);
CREATE INDEX paid_program_day_completions_enrollment_id_idx
  ON public.paid_program_day_completions (enrollment_id, day_number);
CREATE INDEX paid_program_video_views_enrollment_id_idx
  ON public.paid_program_video_views (enrollment_id, day_number, last_viewed_at DESC);
CREATE INDEX customer_measurements_customer_history_idx
  ON public.customer_measurements (customer_id, measured_at DESC, created_at DESC);
CREATE INDEX customer_measurements_enrollment_history_idx
  ON public.customer_measurements (enrollment_id, measured_at DESC, created_at DESC)
  WHERE enrollment_id IS NOT NULL;
CREATE INDEX customer_measurement_revisions_measurement_id_idx
  ON public.customer_measurement_revisions (measurement_id, revision);

CREATE OR REPLACE FUNCTION public.protect_paid_program_enrollment_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.customer_id, NEW.entitlement_id, NEW.product_code, NEW.program_version,
      NEW.program_snapshot, NEW.run_number, NEW.customer_time_zone, NEW.started_at)
    IS DISTINCT FROM
     (OLD.customer_id, OLD.entitlement_id, OLD.product_code, OLD.program_version,
      OLD.program_snapshot, OLD.run_number, OLD.customer_time_zone, OLD.started_at)
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
    'paid_program_day_completions', 'paid_program_video_views',
    'customer_measurements', 'customer_measurement_revisions', 'customer_active_programs'
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

  IF EXISTS (SELECT 1 FROM public.paid_program_enrollments
    WHERE entitlement_id = p_entitlement_id AND status IN ('active', 'paused'))
  THEN
    RETURN QUERY SELECT 'existing_unfinished_run'::text, NULL::uuid, NULL::integer,
      NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT active.lead_plan_id INTO v_paused_lead_plan_id
    FROM public.customer_active_programs active
   WHERE active.customer_id = p_customer_id AND active.program_kind = 'lead_plan'
   FOR UPDATE;

  UPDATE public.paid_program_enrollments
     SET status = 'paused', paused_at = now(), updated_at = now()
   WHERE customer_id = p_customer_id AND status = 'active'
  RETURNING id INTO v_paused_id;

  SELECT COALESCE(max(run_number), 0) + 1 INTO v_run_number
    FROM public.paid_program_enrollments WHERE entitlement_id = p_entitlement_id;

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
  DELETE FROM public.customer_active_programs
   WHERE customer_id = p_customer_id AND paid_enrollment_id = p_enrollment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_program_run_atomic(
  p_customer_id uuid, p_enrollment_id uuid
) RETURNS TABLE(
  outcome text, enrollment_id uuid, paused_enrollment_id uuid, paused_lead_plan_id uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_paused_id uuid;
  v_paused_lead_plan_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 2));
  PERFORM 1 FROM public.paid_program_enrollments n
    JOIN public.paid_product_entitlements e ON e.id = n.entitlement_id
   WHERE n.id = p_enrollment_id AND n.customer_id = p_customer_id
     AND n.status = 'paused' AND e.status = 'active' FOR UPDATE OF n;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT active.lead_plan_id INTO v_paused_lead_plan_id
    FROM public.customer_active_programs active
   WHERE active.customer_id = p_customer_id AND active.program_kind = 'lead_plan'
   FOR UPDATE;

  UPDATE public.paid_program_enrollments
     SET status = 'paused', paused_at = now(), updated_at = now()
   WHERE customer_id = p_customer_id AND status = 'active' AND id <> p_enrollment_id
  RETURNING id INTO v_paused_id;
  UPDATE public.paid_program_enrollments
     SET status = 'active', paused_at = NULL, updated_at = now()
   WHERE id = p_enrollment_id;
  INSERT INTO public.customer_active_programs (
    customer_id, program_kind, lead_plan_id, paid_enrollment_id
  ) VALUES (p_customer_id, 'paid_run', NULL, p_enrollment_id)
  ON CONFLICT (customer_id) DO UPDATE SET
    program_kind = 'paid_run', lead_plan_id = NULL,
    paid_enrollment_id = EXCLUDED.paid_enrollment_id,
    activated_at = now(), updated_at = now();
  RETURN QUERY SELECT 'resumed'::text, p_enrollment_id,
    v_paused_id, v_paused_lead_plan_id;
END;
$$;

-- Selecting the legacy 7-Day Plan pauses a paid run without resetting either
-- program. A future customer-facing switch warning calls this transaction.
CREATE OR REPLACE FUNCTION public.activate_lead_plan_atomic(
  p_customer_id uuid, p_lead_plan_id uuid
) RETURNS TABLE(outcome text, lead_plan_id uuid, paused_enrollment_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_paused_id uuid;
BEGIN
  IF p_customer_id IS NULL OR p_lead_plan_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 2));

  PERFORM 1
    FROM public.customer_lead_plan_links link
    JOIN public.lead_plans lead ON lead.id = link.lead_plan_id
   WHERE link.customer_id = p_customer_id AND link.lead_plan_id = p_lead_plan_id
     AND jsonb_typeof(lead.plan_json->'days') = 'array'
     AND (SELECT count(*) FROM public.lead_plan_day_completions completion
           WHERE completion.lead_plan_id = p_lead_plan_id)
       < jsonb_array_length(lead.plan_json->'days')
   FOR UPDATE OF link;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.paid_program_enrollments
     SET status = 'paused', paused_at = now(), updated_at = now()
   WHERE customer_id = p_customer_id AND status = 'active'
  RETURNING id INTO v_paused_id;

  INSERT INTO public.customer_active_programs (
    customer_id, program_kind, lead_plan_id, paid_enrollment_id
  ) VALUES (p_customer_id, 'lead_plan', p_lead_plan_id, NULL)
  ON CONFLICT (customer_id) DO UPDATE SET
    program_kind = 'lead_plan', lead_plan_id = EXCLUDED.lead_plan_id,
    paid_enrollment_id = NULL, activated_at = now(), updated_at = now();

  RETURN QUERY SELECT 'activated'::text, p_lead_plan_id, v_paused_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accelerator_progress_state(
  p_enrollment_id uuid, p_program_version text
) RETURNS TABLE(
  completed_days smallint[], current_day smallint, available_on date,
  can_complete_current boolean, undo_day smallint, undo_until timestamptz,
  program_completed boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enrollment public.paid_program_enrollments%ROWTYPE;
  v_previous_completed_at timestamptz;
BEGIN
  SELECT run.* INTO v_enrollment
    FROM public.paid_program_enrollments run
    JOIN public.paid_product_entitlements entitlement ON entitlement.id = run.entitlement_id
   WHERE run.id = p_enrollment_id AND run.program_version = p_program_version
     AND run.status IN ('active', 'paused', 'completed')
     AND entitlement.status = 'active';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(array_agg(completion.day_number ORDER BY completion.day_number),
                  ARRAY[]::smallint[])
    INTO completed_days
    FROM public.paid_program_day_completions completion
   WHERE completion.enrollment_id = p_enrollment_id
     AND completion.program_version = p_program_version;

  SELECT (day.value->>'day')::smallint INTO current_day
    FROM jsonb_array_elements(v_enrollment.program_snapshot->'days') day(value)
   WHERE NOT ((day.value->>'day')::smallint = ANY(completed_days))
   ORDER BY (day.value->>'day')::smallint
   LIMIT 1;

  program_completed := current_day IS NULL;
  available_on := NULL;
  can_complete_current := false;
  IF current_day IS NOT NULL THEN
    IF current_day = 1 THEN
      available_on := (v_enrollment.started_at AT TIME ZONE v_enrollment.customer_time_zone)::date;
    ELSE
      SELECT completion.completed_at INTO v_previous_completed_at
        FROM public.paid_program_day_completions completion
       WHERE completion.enrollment_id = p_enrollment_id
         AND completion.day_number = current_day - 1;
      IF v_previous_completed_at IS NOT NULL THEN
        available_on :=
          (v_previous_completed_at AT TIME ZONE v_enrollment.customer_time_zone)::date + 1;
      END IF;
    END IF;
    can_complete_current := v_enrollment.status = 'active'
      AND available_on IS NOT NULL
      AND (now() AT TIME ZONE v_enrollment.customer_time_zone)::date >= available_on;
  END IF;

  SELECT completion.day_number, completion.undo_until
    INTO undo_day, undo_until
    FROM public.paid_program_day_completions completion
   WHERE completion.enrollment_id = p_enrollment_id
     AND completion.program_version = p_program_version
     AND completion.undo_until >= now()
   ORDER BY completion.day_number DESC
   LIMIT 1;

  RETURN NEXT;
END;
$$;

-- Only the earliest unfinished assignment can be completed, and Days 2-28
-- wait for the next calendar date in the run's captured IANA time zone.
CREATE OR REPLACE FUNCTION public.complete_accelerator_day_atomic(
  p_enrollment_id uuid, p_program_version text, p_day_number smallint
) RETURNS TABLE(
  completed_days smallint[], newly_completed boolean, program_completed boolean,
  current_day smallint, available_on date, can_complete_current boolean,
  undo_day smallint, undo_until timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enrollment public.paid_program_enrollments%ROWTYPE;
  v_customer_id uuid;
  v_inserted_day smallint;
  v_current_day smallint;
  v_previous_completed_at timestamptz;
  v_total_days integer;
BEGIN
  IF p_enrollment_id IS NULL OR p_program_version IS NULL OR p_day_number IS NULL
  THEN RETURN; END IF;
  SELECT run.customer_id INTO v_customer_id
    FROM public.paid_program_enrollments run WHERE run.id = p_enrollment_id;
  IF v_customer_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_customer_id::text, 2));
  SELECT n.* INTO v_enrollment FROM public.paid_program_enrollments n
    JOIN public.paid_product_entitlements e ON e.id = n.entitlement_id
   WHERE n.id = p_enrollment_id AND n.program_version = p_program_version
     AND n.status = 'active' AND e.status = 'active' FOR UPDATE OF n;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.paid_program_day_completions completion
    WHERE completion.enrollment_id = p_enrollment_id
      AND completion.day_number = p_day_number)
  THEN
    RETURN QUERY SELECT state.completed_days, false, state.program_completed,
      state.current_day, state.available_on, state.can_complete_current,
      state.undo_day, state.undo_until
      FROM public.accelerator_progress_state(p_enrollment_id, p_program_version) state;
    RETURN;
  END IF;

  SELECT (day.value->>'day')::smallint INTO v_current_day
    FROM jsonb_array_elements(v_enrollment.program_snapshot->'days') day(value)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.paid_program_day_completions completion
      WHERE completion.enrollment_id = p_enrollment_id
        AND completion.day_number = (day.value->>'day')::smallint
   )
   ORDER BY (day.value->>'day')::smallint LIMIT 1;
  IF v_current_day IS NULL OR p_day_number <> v_current_day THEN RETURN; END IF;

  IF v_current_day > 1 THEN
    SELECT completion.completed_at INTO v_previous_completed_at
      FROM public.paid_program_day_completions completion
     WHERE completion.enrollment_id = p_enrollment_id
       AND completion.day_number = v_current_day - 1;
    IF v_previous_completed_at IS NULL
      OR (now() AT TIME ZONE v_enrollment.customer_time_zone)::date
        <= (v_previous_completed_at AT TIME ZONE v_enrollment.customer_time_zone)::date
    THEN RETURN; END IF;
  END IF;

  INSERT INTO public.paid_program_day_completions (
    enrollment_id, program_version, day_number, completed_at, undo_until
  ) VALUES (p_enrollment_id, p_program_version, p_day_number, now(), now() + interval '10 minutes')
  ON CONFLICT (enrollment_id, day_number) DO NOTHING RETURNING day_number INTO v_inserted_day;

  v_total_days := jsonb_array_length(v_enrollment.program_snapshot->'days');
  IF (SELECT count(*) FROM public.paid_program_day_completions completion
       WHERE completion.enrollment_id = p_enrollment_id) = v_total_days THEN
    UPDATE public.paid_program_enrollments SET status = 'completed', paused_at = NULL,
      completed_at = now(), updated_at = now() WHERE id = p_enrollment_id;
    DELETE FROM public.customer_active_programs
     WHERE customer_id = v_enrollment.customer_id AND paid_enrollment_id = p_enrollment_id;
  END IF;

  RETURN QUERY SELECT state.completed_days, v_inserted_day IS NOT NULL,
    state.program_completed, state.current_day, state.available_on,
    state.can_complete_current, state.undo_day, state.undo_until
    FROM public.accelerator_progress_state(p_enrollment_id, p_program_version) state;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_accelerator_day_atomic(
  p_enrollment_id uuid, p_program_version text, p_day_number smallint
) RETURNS TABLE(
  completed_days smallint[], undone boolean, program_completed boolean,
  current_day smallint, available_on date, can_complete_current boolean,
  undo_day smallint, undo_until timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enrollment public.paid_program_enrollments%ROWTYPE;
  v_latest public.paid_program_day_completions%ROWTYPE;
  v_customer_id uuid;
BEGIN
  SELECT run.customer_id INTO v_customer_id
    FROM public.paid_program_enrollments run WHERE run.id = p_enrollment_id;
  IF v_customer_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_customer_id::text, 2));
  SELECT run.* INTO v_enrollment
    FROM public.paid_program_enrollments run
    JOIN public.paid_product_entitlements entitlement ON entitlement.id = run.entitlement_id
   WHERE run.id = p_enrollment_id AND run.program_version = p_program_version
     AND run.status IN ('active', 'completed') AND entitlement.status = 'active'
   FOR UPDATE OF run;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT completion.* INTO v_latest
    FROM public.paid_program_day_completions completion
   WHERE completion.enrollment_id = p_enrollment_id
     AND completion.program_version = p_program_version
   ORDER BY completion.day_number DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_latest.day_number <> p_day_number OR v_latest.undo_until < now()
  THEN RETURN; END IF;

  IF v_enrollment.status = 'completed' THEN
    -- Saving final results moves the customer beyond the brief Day 28 Undo step.
    -- Do not reopen a run and leave final-only measurements attached to it.
    IF EXISTS (
      SELECT 1 FROM public.customer_measurements measurement
       WHERE measurement.enrollment_id = p_enrollment_id
         AND measurement.measurement_context = 'final'
         AND measurement.status = 'active'
    ) THEN RETURN; END IF;
    IF EXISTS (SELECT 1 FROM public.paid_program_enrollments other
      WHERE other.customer_id = v_enrollment.customer_id AND other.status = 'active'
        AND other.id <> p_enrollment_id)
      OR EXISTS (SELECT 1 FROM public.customer_active_programs active
        WHERE active.customer_id = v_enrollment.customer_id
          AND active.paid_enrollment_id IS DISTINCT FROM p_enrollment_id)
    THEN RETURN; END IF;
    UPDATE public.paid_program_enrollments
       SET status = 'active', completed_at = NULL, updated_at = now()
     WHERE id = p_enrollment_id;
    INSERT INTO public.customer_active_programs (
      customer_id, program_kind, lead_plan_id, paid_enrollment_id
    ) VALUES (v_enrollment.customer_id, 'paid_run', NULL, p_enrollment_id)
    ON CONFLICT (customer_id) DO UPDATE SET
      program_kind = 'paid_run', lead_plan_id = NULL,
      paid_enrollment_id = EXCLUDED.paid_enrollment_id,
      activated_at = now(), updated_at = now();
  END IF;

  DELETE FROM public.paid_program_day_completions WHERE id = v_latest.id;
  RETURN QUERY SELECT state.completed_days, true, state.program_completed,
    state.current_day, state.available_on, state.can_complete_current,
    state.undo_day, state.undo_until
    FROM public.accelerator_progress_state(p_enrollment_id, p_program_version) state;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_accelerator_video_view_atomic(
  p_enrollment_id uuid, p_program_version text, p_day_number smallint, p_media_key text
) RETURNS SETOF public.paid_program_video_views
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_completed_days smallint[];
  v_current_day smallint;
  v_can_complete_current boolean;
BEGIN
  IF p_media_key IS NULL OR length(btrim(p_media_key)) NOT BETWEEN 1 AND 200 THEN RETURN; END IF;
  PERFORM 1 FROM public.paid_program_enrollments run
    JOIN public.paid_product_entitlements entitlement ON entitlement.id = run.entitlement_id
   WHERE run.id = p_enrollment_id AND run.program_version = p_program_version
     AND run.status IN ('active', 'paused', 'completed') AND entitlement.status = 'active'
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(run.program_snapshot->'days') day(value)
       WHERE (day.value->>'day')::smallint = p_day_number)
   FOR UPDATE OF run;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT state.completed_days, state.current_day, state.can_complete_current
    INTO v_completed_days, v_current_day, v_can_complete_current
    FROM public.accelerator_progress_state(p_enrollment_id, p_program_version) state;
  IF NOT (p_day_number = ANY(v_completed_days)
    OR (p_day_number = v_current_day AND v_can_complete_current))
  THEN RETURN; END IF;

  RETURN QUERY INSERT INTO public.paid_program_video_views (
    enrollment_id, program_version, day_number, media_key
  ) VALUES (p_enrollment_id, p_program_version, p_day_number, btrim(p_media_key))
  ON CONFLICT (enrollment_id, day_number, media_key) DO UPDATE SET
    last_viewed_at = now(), view_count = paid_program_video_views.view_count + 1,
    updated_at = now()
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_customer_measurement_atomic(
  p_customer_id uuid, p_enrollment_id uuid, p_measurement_kind text,
  p_value numeric, p_unit text, p_measurement_context text,
  p_notes text, p_measured_at timestamptz
) RETURNS SETOF public.customer_measurements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_measurement public.customer_measurements%ROWTYPE;
BEGIN
  IF p_customer_id IS NULL OR p_value <= 0 OR p_measured_at IS NULL
    OR p_measured_at > now() + interval '5 minutes'
    OR p_measurement_kind NOT IN ('weight', 'waist')
    OR (p_measurement_kind = 'weight' AND p_unit NOT IN ('lb', 'kg'))
    OR (p_measurement_kind = 'waist' AND p_unit NOT IN ('in', 'cm'))
    OR p_measurement_context NOT IN ('general', 'starting', 'progress', 'final')
    OR (p_measurement_context = 'general' AND p_enrollment_id IS NOT NULL)
    OR (p_measurement_context <> 'general' AND p_enrollment_id IS NULL)
    OR length(COALESCE(p_notes, '')) > 1000
  THEN RETURN; END IF;

  IF p_measurement_context = 'general' THEN
    PERFORM 1 FROM public.customer_accounts customer WHERE customer.id = p_customer_id;
    IF NOT FOUND THEN RETURN; END IF;
  ELSE
    PERFORM 1 FROM public.paid_program_enrollments run
      JOIN public.paid_product_entitlements entitlement ON entitlement.id = run.entitlement_id
     WHERE run.id = p_enrollment_id AND run.customer_id = p_customer_id
       AND run.status IN ('active', 'paused', 'completed') AND entitlement.status = 'active'
     FOR UPDATE OF run;
    IF NOT FOUND THEN RETURN; END IF;
    IF p_measurement_context = 'final' AND NOT EXISTS (
      SELECT 1 FROM public.paid_program_enrollments run
       WHERE run.id = p_enrollment_id AND run.status = 'completed'
    ) THEN RETURN; END IF;
  END IF;

  INSERT INTO public.customer_measurements (
    customer_id, enrollment_id, measurement_kind, value, unit,
    measurement_context, notes, measured_at
  ) VALUES (
    p_customer_id, p_enrollment_id, p_measurement_kind, p_value, p_unit,
    p_measurement_context, NULLIF(btrim(p_notes), ''), p_measured_at
  ) RETURNING * INTO v_measurement;

  INSERT INTO public.customer_measurement_revisions (
    measurement_id, revision, action, value, unit, notes, measured_at
  ) VALUES (
    v_measurement.id, v_measurement.revision, 'created', v_measurement.value,
    v_measurement.unit, v_measurement.notes, v_measurement.measured_at
  );
  RETURN NEXT v_measurement;
END;
$$;

-- Starting a run and recording optional setup measurements is one transaction.
-- Any measurement failure raises an exception and rolls back the new run.
CREATE OR REPLACE FUNCTION public.begin_accelerator_run_atomic(
  p_customer_id uuid, p_entitlement_id uuid, p_program_version text,
  p_program_snapshot jsonb, p_customer_time_zone text,
  p_starting_weight numeric, p_weight_unit text,
  p_starting_waist numeric, p_waist_unit text
) RETURNS TABLE(
  outcome text, enrollment_id uuid, run_number integer,
  paused_enrollment_id uuid, paused_lead_plan_id uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run record;
  v_saved integer;
BEGIN
  IF (p_starting_weight IS NOT NULL AND (p_starting_weight <= 0 OR p_weight_unit IS NULL OR p_weight_unit NOT IN ('lb', 'kg')))
    OR (p_starting_weight IS NULL AND p_weight_unit IS NOT NULL)
    OR (p_starting_waist IS NOT NULL AND (p_starting_waist <= 0 OR p_waist_unit IS NULL OR p_waist_unit NOT IN ('in', 'cm')))
    OR (p_starting_waist IS NULL AND p_waist_unit IS NOT NULL)
  THEN RETURN; END IF;

  SELECT * INTO v_run FROM public.start_program_run_atomic(
    p_customer_id, p_entitlement_id, p_program_version,
    p_program_snapshot, p_customer_time_zone
  );
  IF NOT FOUND OR v_run.outcome <> 'started' THEN
    IF FOUND THEN
      RETURN QUERY SELECT v_run.outcome, v_run.enrollment_id, v_run.run_number,
        v_run.paused_enrollment_id, v_run.paused_lead_plan_id;
    END IF;
    RETURN;
  END IF;

  IF p_starting_weight IS NOT NULL THEN
    PERFORM * FROM public.add_customer_measurement_atomic(
      p_customer_id, v_run.enrollment_id, 'weight', p_starting_weight,
      p_weight_unit, 'starting', NULL, now()
    );
    GET DIAGNOSTICS v_saved = ROW_COUNT;
    IF v_saved <> 1 THEN RAISE EXCEPTION 'Starting weight was not saved'; END IF;
  END IF;

  IF p_starting_waist IS NOT NULL THEN
    PERFORM * FROM public.add_customer_measurement_atomic(
      p_customer_id, v_run.enrollment_id, 'waist', p_starting_waist,
      p_waist_unit, 'starting', NULL, now()
    );
    GET DIAGNOSTICS v_saved = ROW_COUNT;
    IF v_saved <> 1 THEN RAISE EXCEPTION 'Starting waist was not saved'; END IF;
  END IF;

  RETURN QUERY SELECT v_run.outcome, v_run.enrollment_id, v_run.run_number,
    v_run.paused_enrollment_id, v_run.paused_lead_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.correct_customer_measurement_atomic(
  p_customer_id uuid, p_measurement_id uuid, p_value numeric, p_unit text,
  p_notes text, p_measured_at timestamptz
) RETURNS SETOF public.customer_measurements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_measurement public.customer_measurements%ROWTYPE;
BEGIN
  SELECT * INTO v_measurement FROM public.customer_measurements measurement
   WHERE measurement.id = p_measurement_id AND measurement.customer_id = p_customer_id
     AND measurement.status = 'active' FOR UPDATE;
  IF NOT FOUND OR p_value <= 0 OR p_measured_at IS NULL
    OR p_measured_at > now() + interval '5 minutes'
    OR (v_measurement.measurement_kind = 'weight' AND p_unit NOT IN ('lb', 'kg'))
    OR (v_measurement.measurement_kind = 'waist' AND p_unit NOT IN ('in', 'cm'))
    OR length(COALESCE(p_notes, '')) > 1000
  THEN RETURN; END IF;

  UPDATE public.customer_measurements SET
    value = p_value, unit = p_unit, notes = NULLIF(btrim(p_notes), ''),
    measured_at = p_measured_at, revision = revision + 1, updated_at = now()
   WHERE id = p_measurement_id RETURNING * INTO v_measurement;
  INSERT INTO public.customer_measurement_revisions (
    measurement_id, revision, action, value, unit, notes, measured_at
  ) VALUES (
    v_measurement.id, v_measurement.revision, 'corrected', v_measurement.value,
    v_measurement.unit, v_measurement.notes, v_measurement.measured_at
  );
  RETURN NEXT v_measurement;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_customer_measurement_atomic(
  p_customer_id uuid, p_measurement_id uuid
) RETURNS TABLE(measurement_id uuid, removed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_measurement public.customer_measurements%ROWTYPE;
BEGIN
  SELECT * INTO v_measurement FROM public.customer_measurements measurement
   WHERE measurement.id = p_measurement_id AND measurement.customer_id = p_customer_id
     AND measurement.status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.customer_measurements SET
    status = 'removed', removed_at = now(), revision = revision + 1, updated_at = now()
   WHERE id = p_measurement_id RETURNING * INTO v_measurement;
  INSERT INTO public.customer_measurement_revisions (
    measurement_id, revision, action, value, unit, notes, measured_at
  ) VALUES (
    v_measurement.id, v_measurement.revision, 'removed', v_measurement.value,
    v_measurement.unit, v_measurement.notes, v_measurement.measured_at
  );
  RETURN QUERY SELECT v_measurement.id, true;
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
REVOKE ALL ON FUNCTION public.start_program_run_atomic(uuid, uuid, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_program_run_atomic(uuid, uuid, text, jsonb, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.pause_program_run_atomic(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_program_run_atomic(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.resume_program_run_atomic(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resume_program_run_atomic(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.activate_lead_plan_atomic(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_lead_plan_atomic(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.accelerator_progress_state(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerator_progress_state(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.complete_accelerator_day_atomic(uuid, text, smallint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_accelerator_day_atomic(uuid, text, smallint) TO service_role;
REVOKE ALL ON FUNCTION public.undo_accelerator_day_atomic(uuid, text, smallint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_accelerator_day_atomic(uuid, text, smallint) TO service_role;
REVOKE ALL ON FUNCTION public.record_accelerator_video_view_atomic(uuid, text, smallint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_accelerator_video_view_atomic(uuid, text, smallint, text)
  TO service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_measurements FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_measurement_revisions FROM service_role;
REVOKE ALL ON FUNCTION public.add_customer_measurement_atomic(
  uuid, uuid, text, numeric, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_customer_measurement_atomic(
  uuid, uuid, text, numeric, text, text, text, timestamptz
) TO service_role;
REVOKE ALL ON FUNCTION public.begin_accelerator_run_atomic(
  uuid, uuid, text, jsonb, text, numeric, text, numeric, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_accelerator_run_atomic(
  uuid, uuid, text, jsonb, text, numeric, text, numeric, text
) TO service_role;
REVOKE ALL ON FUNCTION public.correct_customer_measurement_atomic(
  uuid, uuid, numeric, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.correct_customer_measurement_atomic(
  uuid, uuid, numeric, text, text, timestamptz
) TO service_role;
REVOKE ALL ON FUNCTION public.remove_customer_measurement_atomic(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_customer_measurement_atomic(uuid, uuid) TO service_role;