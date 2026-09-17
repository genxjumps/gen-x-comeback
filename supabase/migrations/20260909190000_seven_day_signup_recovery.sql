-- Repeat signup resumes; only an authenticated participant action may restart.
-- Forward-only. No existing data, email control, or historical migration is changed.
-- The compatibility RPC keeps its signature. PL/pgSQL column resolution is
-- pinned because output names overlap existing column names in replacement SQL.
CREATE OR REPLACE FUNCTION public.commit_plan_version(p_submission_id uuid, p_assessment jsonb, p_plan jsonb, p_session_token_hash text, p_request_fingerprint text, p_lead_plan_id uuid DEFAULT NULL::uuid, p_email_normalized text DEFAULT NULL::text, p_email_original text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_consent_copy text DEFAULT NULL::text, p_consent_version text DEFAULT NULL::text)
 RETURNS TABLE(lead_plan_id uuid, plan_version_id uuid, job_id uuid, first_name text, source text, replayed boolean, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_existing public.plan_submissions;
  v_lead public.lead_plans;
  v_lead_id uuid;
  v_version uuid;
  v_job_id uuid;
  v_final_rescue_job_id uuid;
  v_event_id uuid;
  v_source text;
  v_changed boolean;
  v_now timestamptz := now();
BEGIN
  IF p_submission_id IS NULL OR p_session_token_hash IS NULL OR p_request_fingerprint IS NULL THEN
    RAISE EXCEPTION 'submission identity is required';
  END IF;

  -- Serialize both first-time saves and retries by normalized identity.
  IF p_email_normalized IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('gxj_signup:' || lower(trim(p_email_normalized)), 0));
  ELSIF p_lead_plan_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('gxj_signup:' ||
      (SELECT lp.email_normalized FROM public.lead_plans lp WHERE lp.id = p_lead_plan_id), 0));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gxj_submission:' || p_submission_id::text, 0));

  SELECT * INTO v_existing FROM public.plan_submissions WHERE submission_id = p_submission_id;
  IF FOUND THEN
    -- Reusing a submission id with any different binding is a conflict and
    -- discloses nothing about the original lead.
    IF (v_existing.request_fingerprint IS NOT NULL
        AND v_existing.request_fingerprint <> p_request_fingerprint)
    OR (v_existing.session_token_hash IS NOT NULL
        AND v_existing.session_token_hash <> p_session_token_hash)
    OR (p_email_normalized IS NOT NULL AND v_existing.email_normalized IS NOT NULL
        AND v_existing.email_normalized <> p_email_normalized)
    OR (p_lead_plan_id IS NOT NULL AND v_existing.lead_plan_id <> p_lead_plan_id) THEN
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text,
                          'conflict'::text, false, 'conflict'::text;
      RETURN;
    END IF;

    SELECT * INTO v_lead FROM public.lead_plans WHERE id = v_existing.lead_plan_id;
    IF v_lead.id IS NULL OR v_lead.plan_version_id <> v_existing.plan_version_id THEN
      -- The plan this submission created was replaced. No access is granted.
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text,
                          'stale_replay'::text, true, 'stale_replay'::text;
      RETURN;
    END IF;

    -- Exact replay: no new plan, job, event, token, session, or send.
    RETURN QUERY SELECT v_existing.lead_plan_id, v_existing.plan_version_id, v_existing.job_id,
                        v_lead.first_name, v_existing.source, true, 'replay'::text;
    RETURN;
  END IF;

  IF p_lead_plan_id IS NOT NULL THEN
    SELECT * INTO v_lead FROM public.lead_plans WHERE id = p_lead_plan_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lead plan not found';
    END IF;
  ELSIF p_email_normalized IS NOT NULL THEN
    SELECT * INTO v_lead FROM public.lead_plans WHERE email_normalized = p_email_normalized FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'lead identity is required';
  END IF;

  -- Email-only signup can never grant access to or replace an existing plan.
  -- A server-authorized participant action supplies p_lead_plan_id separately.
  IF v_lead.id IS NOT NULL AND p_lead_plan_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text,
                        'existing'::text, false, 'existing'::text;
    RETURN;
  END IF;

  IF v_lead.id IS NULL THEN
    v_source := 'new_plan';
    v_version := gen_random_uuid();
    INSERT INTO public.lead_plans (
      email_normalized, email_original, first_name, consent_granted, consent_copy,
      consent_version, consent_at, assessment_json, plan_json, plan_version_id,
      created_at, updated_at
    ) VALUES (
      p_email_normalized, COALESCE(p_email_original, p_email_normalized),
      COALESCE(p_first_name, 'there'), true, COALESCE(p_consent_copy, ''),
      COALESCE(p_consent_version, 'v1'), v_now, p_assessment, p_plan, v_version, v_now, v_now
    )
    RETURNING * INTO v_lead;
    v_lead_id := v_lead.id;
  ELSE
    v_lead_id := v_lead.id;
    -- Completed runs require the dedicated explicit restart transaction, even
    -- if completion races with an older reassessment screen.
    IF (SELECT count(*) FROM public.lead_plan_day_completions c WHERE c.lead_plan_id=v_lead_id) >= 7
      AND p_plan->>'restart_id' IS DISTINCT FROM p_submission_id::text THEN
      RETURN QUERY SELECT NULL::uuid,NULL::uuid,NULL::uuid,NULL::text,'restart_required'::text,false,'restart_required'::text;
      RETURN;
    END IF;
    -- Authoritative comparison against stored JSON. No client flag is trusted.
    v_changed := (v_lead.assessment_json IS DISTINCT FROM p_assessment)
              OR (v_lead.plan_json IS DISTINCT FROM p_plan);

    IF NOT v_changed THEN
      -- Identical reload: version, progress, jobs, tokens and sessions all persist.
      INSERT INTO public.plan_access_sessions (lead_plan_id, plan_version_id, token_hash)
      VALUES (v_lead_id, v_lead.plan_version_id, p_session_token_hash)
      ON CONFLICT (token_hash) DO NOTHING;
      UPDATE public.lead_plans
         SET access_token_hash = p_session_token_hash, updated_at = v_now
       WHERE id = v_lead_id;

      SELECT j.job_id INTO v_job_id FROM public.email_jobs j
        WHERE j.plan_version_id = v_lead.plan_version_id AND j.job_type = 'plan_ready' LIMIT 1;

      INSERT INTO public.plan_submissions (
        submission_id, lead_plan_id, plan_version_id, source, job_id,
        session_token_hash, request_fingerprint, email_normalized
      ) VALUES (
        p_submission_id, v_lead_id, v_lead.plan_version_id, 'unchanged', v_job_id,
        p_session_token_hash, p_request_fingerprint, v_lead.email_normalized
      );

      RETURN QUERY SELECT v_lead_id, v_lead.plan_version_id, v_job_id,
                          v_lead.first_name, 'unchanged'::text, false, 'unchanged'::text;
      RETURN;
    END IF;

    v_source := 'reassessment';
    v_version := gen_random_uuid();

    -- Plan replacement cancels every unsent job of the replaced plan version,
    -- which includes that version's Final Rescue job.
    UPDATE public.email_jobs
      SET status = 'canceled', canceled_at = v_now, claim_token = NULL,
          locked_at = NULL, lease_expires_at = NULL, updated_at = v_now
      WHERE plan_version_id = v_lead.plan_version_id
        AND status IN ('pending','processing','retry_scheduled');
    UPDATE public.plan_return_tokens
      SET revoked_at = v_now
      WHERE lead_plan_id = v_lead_id AND revoked_at IS NULL;
    UPDATE public.return_link_sessions
      SET revoked_at = v_now
      WHERE lead_plan_id = v_lead_id AND revoked_at IS NULL;
    UPDATE public.plan_access_sessions
      SET revoked_at = v_now
      WHERE lead_plan_id = v_lead_id AND revoked_at IS NULL;
    DELETE FROM public.lead_plan_day_completions WHERE lead_plan_id = v_lead_id;

    UPDATE public.lead_plans SET
      first_name = COALESCE(p_first_name, first_name),
      email_original = COALESCE(p_email_original, email_original),
      consent_copy = COALESCE(p_consent_copy, consent_copy),
      consent_version = COALESCE(p_consent_version, consent_version),
      consent_at = CASE WHEN p_consent_copy IS NULL THEN consent_at ELSE v_now END,
      assessment_json = p_assessment,
      plan_json = p_plan,
      plan_version_id = v_version,
      plan_calendar_configured_at = NULL,
      plan_start_on = (v_now AT TIME ZONE plan_time_zone)::date,
      updated_at = v_now
    WHERE id = v_lead_id
    RETURNING * INTO v_lead;
  END IF;

  INSERT INTO public.plan_access_sessions (lead_plan_id, plan_version_id, token_hash)
  VALUES (v_lead_id, v_version, p_session_token_hash)
  ON CONFLICT (token_hash) DO NOTHING;
  UPDATE public.lead_plans SET access_token_hash = p_session_token_hash WHERE id = v_lead_id;

  INSERT INTO public.canonical_events
    (event_name, event_version, lead_plan_id, plan_version_id, submission_id, source, occurred_at)
  VALUES ('plan_committed', 'v1', v_lead_id, v_version, p_submission_id, v_source, v_now)
  RETURNING event_id INTO v_event_id;

  INSERT INTO public.email_jobs (
    job_type, job_version, template_version, lead_plan_id, plan_version_id,
    source_event_id, idempotency_key, eligible_at, status, created_at, updated_at
  ) VALUES (
    'plan_ready', 'v1', 'plan_ready_v1', v_lead_id, v_version,
    v_event_id, 'plan_ready:' || v_version::text || ':v1', v_now, 'pending', v_now, v_now
  )
  RETURNING email_jobs.job_id INTO v_job_id;

  INSERT INTO public.canonical_events
    (event_name, lead_plan_id, plan_version_id, submission_id, job_id, occurred_at)
  VALUES ('email_plan_ready_queued', v_lead_id, v_version, p_submission_id, v_job_id, v_now);

  -- Final Rescue is created in this same authoritative transaction, exactly one
  -- per newly committed plan version, anchored to the persisted commit
  -- timestamp plus 4 days. No provider call happens here, and no existing plan
  -- version is backfilled: only a newly committed version gets a job.
  INSERT INTO public.email_jobs (
    job_type, job_version, template_version, lead_plan_id, plan_version_id,
    source_event_id, idempotency_key, eligible_at, status, created_at, updated_at
  ) VALUES (
    'final_rescue', 'v1', 'final_rescue_v1', v_lead_id, v_version,
    v_event_id, 'final_rescue:' || v_version::text || ':v1',
    v_now + interval '4 days', 'pending', v_now, v_now
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING email_jobs.job_id INTO v_final_rescue_job_id;

  -- Exactly one queued event, only when a job row was actually created.
  IF v_final_rescue_job_id IS NOT NULL THEN
    INSERT INTO public.canonical_events
      (event_name, event_version, lead_plan_id, plan_version_id, submission_id, job_id, occurred_at)
    VALUES ('email_final_rescue_queued', 'v1', v_lead_id, v_version, p_submission_id,
            v_final_rescue_job_id, v_now);
  END IF;

  INSERT INTO public.plan_submissions (
    submission_id, lead_plan_id, plan_version_id, source, job_id,
    session_token_hash, request_fingerprint, email_normalized
  ) VALUES (
    p_submission_id, v_lead_id, v_version, v_source, v_job_id,
    p_session_token_hash, p_request_fingerprint, v_lead.email_normalized
  );

  RETURN QUERY SELECT v_lead_id, v_version, v_job_id, v_lead.first_name,
                      v_source, false, v_source;
END $function$;

-- Browser handoffs and emailed proof are distinct capabilities.
ALTER TABLE public.lead_intakes
  ADD COLUMN controlled_test boolean NOT NULL DEFAULT false;
CREATE TABLE public.lead_intake_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  intake_id uuid NOT NULL REFERENCES public.lead_intakes(intake_id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lead_intake_welcome_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL UNIQUE REFERENCES public.lead_intakes(intake_id),
  idempotency_key text NOT NULL UNIQUE,
  token_hash text UNIQUE,
  token_expires_at timestamptz,
  status public.email_job_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  claim_token uuid,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz,
  first_provider_attempt_at timestamptz,
  provider_key text,
  provider_message_id text,
  provider_accepted_at timestamptz,
  delivery_status public.email_delivery_status NOT NULL DEFAULT 'pending',
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_intake_welcome_due ON public.lead_intake_welcome_jobs(status, next_attempt_at);
CREATE INDEX lead_intake_welcome_provider ON public.lead_intake_welcome_jobs(provider_key, provider_message_id);
ALTER TABLE public.lead_intake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_intake_welcome_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_intake_sessions, public.lead_intake_welcome_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.lead_intake_sessions, public.lead_intake_welcome_jobs TO service_role;
CREATE POLICY "Service role manages intake sessions" ON public.lead_intake_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages welcome jobs" ON public.lead_intake_welcome_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE FUNCTION public.enqueue_lead_intake_welcome() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.lead_intake_welcome_jobs(intake_id, idempotency_key)
    VALUES (NEW.intake_id, 'intake_welcome:' || md5(NEW.email_normalized) || ':' ||
      floor(extract(epoch FROM now()) / 300)::text)
    ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER lead_intake_welcome_insert AFTER INSERT ON public.lead_intakes
FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_intake_welcome();

-- Resolve either the original handoff or an email-established browser session.
-- Completed intakes remain resolvable so a response-lost save can replay.
CREATE FUNCTION public.resolve_signup_intake(p_token_hash text)
RETURNS SETOF public.lead_intakes LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.* FROM public.lead_intakes i WHERE
    (i.token_hash = p_token_hash AND i.expires_at > now()) OR EXISTS (
      SELECT 1 FROM public.lead_intake_sessions s WHERE s.intake_id = i.intake_id
        AND s.token_hash = p_token_hash AND s.expires_at > now())
$$;

-- Deliberate email-link POST only. Each use creates a separate portable session.
CREATE FUNCTION public.exchange_signup_welcome(p_email_token_hash text, p_session_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_intake_id uuid;
BEGIN
  SELECT j.intake_id INTO v_intake_id FROM public.lead_intake_welcome_jobs j
    WHERE j.token_hash = p_email_token_hash AND j.token_expires_at > now();
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.lead_intake_sessions(token_hash, intake_id, expires_at)
    VALUES(p_session_hash, v_intake_id, now() + interval '30 days');
  RETURN true;
END $$;

-- Only email-established sessions may create existing-plan access here.
-- A plain signup handoff can never reach this branch successfully.
CREATE FUNCTION public.open_signup_existing_plan(p_session_hash text, p_plan_session_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_lead public.lead_plans;
BEGIN
  SELECT i.email_normalized INTO v_email FROM public.lead_intake_sessions s
    JOIN public.lead_intakes i ON i.intake_id = s.intake_id
    WHERE s.token_hash = p_session_hash AND s.expires_at > now();
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gxj_signup:' || v_email, 0));
  SELECT lp.* INTO v_lead FROM public.lead_plans lp WHERE lp.email_normalized = v_email FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.return_link_sessions(session_token_hash, lead_plan_id, plan_version_id, expires_at)
    VALUES(p_plan_session_hash, v_lead.id, v_lead.plan_version_id, now() + interval '30 days');
  UPDATE public.lead_plans SET email_verified_at = COALESCE(email_verified_at, now()),
    email_last_engaged_at = now() WHERE id = v_lead.id;
  RETURN true;
END $$;

-- Save, calendar, intake completion, and controlled Plan Ready scope commit
-- together. Email remains an outbox side effect after this transaction commits.
CREATE FUNCTION public.save_signup_plan(p_token_hash text, p_submission_id uuid,
  p_session_token_hash text, p_request_fingerprint text, p_assessment jsonb, p_plan jsonb, p_time_zone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_intake public.lead_intakes; v_result record;
BEGIN
  SELECT i.* INTO v_intake FROM public.resolve_signup_intake(p_token_hash) i;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','expired'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gxj_signup:' || v_intake.email_normalized, 0));
  SELECT i.* INTO v_intake FROM public.lead_intakes i WHERE i.intake_id = v_intake.intake_id FOR UPDATE;
  IF v_intake.bound_submission_id IS NOT NULL AND v_intake.bound_submission_id <> p_submission_id THEN
    RETURN jsonb_build_object('outcome','resume');
  END IF;
  SELECT * INTO v_result FROM public.commit_plan_version(
    p_submission_id, p_assessment, p_plan, p_session_token_hash, p_request_fingerprint,
    NULL, v_intake.email_normalized, v_intake.email_original, v_intake.first_name,
    v_intake.consent_copy, v_intake.consent_version);
  IF v_result.outcome NOT IN ('new_plan','replay') THEN
    RETURN jsonb_build_object('outcome','resume');
  END IF;
  IF NOT public.configure_lead_plan_calendar(v_result.lead_plan_id, p_time_zone) THEN
    RAISE EXCEPTION 'invalid plan timezone';
  END IF;
  UPDATE public.lead_intakes SET bound_submission_id = p_submission_id,
    completed_lead_plan_id = v_result.lead_plan_id, completed_at = COALESCE(completed_at, now())
    WHERE intake_id = v_intake.intake_id;
  IF v_intake.controlled_test THEN
    UPDATE public.email_production_control SET controlled_lead_plan_id = v_result.lead_plan_id,
      updated_at = now() WHERE singleton_id = 1 AND NOT genuine_plans_admitted;
  END IF;
  RETURN jsonb_build_object('outcome','saved','replayed',v_result.replayed,'leadPlanId',v_result.lead_plan_id);
END $$;

-- Retain completed history before a deliberate restart. Retry the same action
-- id/version safely; a stale tab cannot restart a newer run.
CREATE TABLE public.lead_plan_completed_runs (
  plan_version_id uuid PRIMARY KEY,
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id),
  assessment_json jsonb NOT NULL,
  plan_json jsonb NOT NULL,
  completions jsonb NOT NULL,
  plan_start_on date NOT NULL,
  plan_time_zone text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_plan_completed_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_plan_completed_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.lead_plan_completed_runs TO service_role;
CREATE POLICY "Service role manages completed runs" ON public.lead_plan_completed_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE FUNCTION public.restart_completed_signup_plan(p_lead_plan_id uuid, p_expected_version uuid,
  p_submission_id uuid, p_session_token_hash text, p_time_zone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead public.lead_plans; v_result record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('gxj_signup:' ||
    (SELECT lp.email_normalized FROM public.lead_plans lp WHERE lp.id = p_lead_plan_id), 0));
  SELECT lp.* INTO v_lead FROM public.lead_plans lp WHERE lp.id = p_lead_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.plan_submissions s WHERE s.submission_id = p_submission_id
      AND s.lead_plan_id = p_lead_plan_id AND s.plan_version_id = v_lead.plan_version_id
      AND s.session_token_hash = p_session_token_hash AND s.request_fingerprint = 'restart:' || p_expected_version::text) THEN
    RETURN true;
  END IF;
  IF v_lead.plan_version_id <> p_expected_version OR jsonb_array_length(v_lead.plan_json->'days') <> 7
    OR EXISTS (SELECT 1 FROM generate_series(1,7) d WHERE NOT EXISTS (
      SELECT 1 FROM public.lead_plan_day_completions c WHERE c.lead_plan_id = p_lead_plan_id AND c.day_number = d))
  THEN RETURN false; END IF;
  INSERT INTO public.lead_plan_completed_runs(plan_version_id, lead_plan_id, assessment_json, plan_json, completions, plan_start_on, plan_time_zone)
    SELECT v_lead.plan_version_id, v_lead.id, v_lead.assessment_json, v_lead.plan_json,
      (SELECT jsonb_agg(to_jsonb(c)) FROM public.lead_plan_day_completions c WHERE c.lead_plan_id = v_lead.id),
      v_lead.plan_start_on, v_lead.plan_time_zone ON CONFLICT DO NOTHING;
  SELECT * INTO v_result FROM public.commit_plan_version(p_submission_id, v_lead.assessment_json,
    v_lead.plan_json || jsonb_build_object('restart_id',p_submission_id), p_session_token_hash,
    'restart:' || p_expected_version::text, p_lead_plan_id);
  IF v_result.outcome <> 'reassessment' THEN RETURN false; END IF;
  -- Restarting the same workouts is not a fresh bundled-consent signup.
  -- The legacy version-change trigger activates both lists; restore the
  -- participant's independent preferences inside this same transaction.
  -- This UPDATE does not change plan_version_id and cannot retrigger activation.
  UPDATE public.lead_plans SET
    plan_email_consent_active=v_lead.plan_email_consent_active,
    plan_email_consent_source=v_lead.plan_email_consent_source,
    plan_email_consent_at=v_lead.plan_email_consent_at,
    plan_email_unsubscribed_at=v_lead.plan_email_unsubscribed_at,
    marketing_consent_active=v_lead.marketing_consent_active,
    marketing_consent_source=v_lead.marketing_consent_source,
    marketing_consent_at=v_lead.marketing_consent_at,
    marketing_unsubscribed_at=v_lead.marketing_unsubscribed_at
    WHERE id=p_lead_plan_id;
  IF NOT public.configure_lead_plan_calendar(p_lead_plan_id, p_time_zone) THEN RAISE EXCEPTION 'invalid timezone'; END IF;
  RETURN true;
END $$;
-- Welcome messages share the exact rolling provider capacity ledger.
ALTER TABLE public.email_provider_submissions
  ADD COLUMN intake_welcome_job_id uuid REFERENCES public.lead_intake_welcome_jobs(job_id),
  DROP CONSTRAINT email_provider_submission_owner_check,
  ADD CONSTRAINT email_provider_submission_owner_check CHECK (
    (job_id IS NOT NULL AND lead_plan_id IS NOT NULL AND paid_access_job_id IS NULL AND customer_id IS NULL AND intake_welcome_job_id IS NULL)
    OR (job_id IS NULL AND lead_plan_id IS NULL AND paid_access_job_id IS NOT NULL AND customer_id IS NOT NULL AND intake_welcome_job_id IS NULL)
    OR (job_id IS NULL AND lead_plan_id IS NULL AND paid_access_job_id IS NULL AND customer_id IS NULL AND intake_welcome_job_id IS NOT NULL)
  );
CREATE FUNCTION public.claim_signup_welcome_jobs(p_invocation_id uuid, p_limit integer DEFAULT 10)
RETURNS SETOF public.lead_intake_welcome_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_control public.email_production_control;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.email_scheduler_invocations s WHERE s.invocation_id = p_invocation_id
    AND s.authenticated_at IS NOT NULL AND s.completed_at IS NULL) THEN RETURN; END IF;
  SELECT * INTO v_control FROM public.email_production_control WHERE singleton_id = 1;
  IF NOT COALESCE(v_control.sending_enabled,false) OR v_control.activation_boundary IS NULL THEN RETURN; END IF;
  RETURN QUERY WITH due AS (
    SELECT j.job_id FROM public.lead_intake_welcome_jobs j JOIN public.lead_intakes i USING(intake_id)
    WHERE j.status IN ('pending','retry_scheduled','processing')
      AND j.created_at >= v_control.activation_boundary
      AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= now())
      AND (j.status <> 'processing' OR j.lease_expires_at <= now())
      AND (v_control.genuine_plans_admitted OR i.controlled_test)
      AND NOT EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.email_normalized = i.email_normalized AND s.reason IN ('hard_bounce','complaint'))
    ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,0),25)
  ) UPDATE public.lead_intake_welcome_jobs j SET status='processing', attempt_count=j.attempt_count+1,
      claim_token=gen_random_uuid(), lease_expires_at=now()+interval '120 seconds'
    FROM due WHERE j.job_id=due.job_id RETURNING j.*;
END $$;
CREATE FUNCTION public.begin_signup_welcome_attempt(p_job_id uuid, p_claim_token uuid, p_invocation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job public.lead_intake_welcome_jobs; v_intake public.lead_intakes;
  v_control public.email_production_control; v_attempt uuid;
BEGIN
  SELECT * INTO v_job FROM public.lead_intake_welcome_jobs j WHERE j.job_id=p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status <> 'processing' OR v_job.claim_token IS DISTINCT FROM p_claim_token
    OR p_claim_token IS NULL OR v_job.lease_expires_at <= now()
    THEN RETURN jsonb_build_object('outcome','lost_lease'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.email_scheduler_invocations s WHERE s.invocation_id=p_invocation_id
    AND s.authenticated_at IS NOT NULL AND s.completed_at IS NULL)
    THEN RETURN jsonb_build_object('outcome','authentication_blocked'); END IF;
  SELECT * INTO v_control FROM public.email_production_control WHERE singleton_id=1 FOR UPDATE;
  SELECT * INTO v_intake FROM public.lead_intakes i WHERE i.intake_id=v_job.intake_id;
  IF NOT COALESCE(v_control.sending_enabled,false) OR v_control.activation_boundary IS NULL
    OR v_job.created_at < v_control.activation_boundary
    THEN RETURN jsonb_build_object('outcome','sending_disabled'); END IF;
  IF NOT v_control.genuine_plans_admitted AND NOT v_intake.controlled_test
    THEN RETURN jsonb_build_object('outcome','controlled_scope_blocked'); END IF;
  IF EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.email_normalized=v_intake.email_normalized
    AND s.reason IN ('hard_bounce','complaint'))
    THEN RETURN jsonb_build_object('outcome','suppression_blocked'); END IF;
  IF (SELECT count(*) FROM public.email_provider_submissions s WHERE s.reserved_at >= now()-interval '24 hours'
    AND s.status IN ('reserved','accepted','uncertain')) >= v_control.provider_submission_limit
    THEN RETURN jsonb_build_object('outcome','limit_reached'); END IF;
  INSERT INTO public.email_provider_submissions(invocation_id,intake_welcome_job_id,job_type,template_version,idempotency_key,reserved_at)
    VALUES(p_invocation_id,p_job_id,'intake_welcome','intake_welcome_v1',v_job.idempotency_key,now()) RETURNING submission_attempt_id INTO v_attempt;
  UPDATE public.lead_intake_welcome_jobs SET first_provider_attempt_at=COALESCE(first_provider_attempt_at,now()) WHERE job_id=p_job_id;
  RETURN jsonb_build_object('outcome','ok','submission_attempt_id',v_attempt);
END $$;
CREATE FUNCTION public.finish_signup_welcome_job(p_job_id uuid,p_claim_token uuid,p_status public.email_job_status,p_patch jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('provider_accepted','retry_scheduled','failed_permanent','suppressed') THEN RAISE EXCEPTION 'invalid finish'; END IF;
  UPDATE public.lead_intake_welcome_jobs j SET status=p_status,claim_token=NULL,lease_expires_at=NULL,
    attempt_count=CASE WHEN p_patch->>'deferred'='true' THEN GREATEST(j.attempt_count-1,0) ELSE j.attempt_count END,
    next_attempt_at=(p_patch->>'next_attempt_at')::timestamptz,
    provider_key=COALESCE(p_patch->>'provider_key',j.provider_key),
    provider_message_id=COALESCE(p_patch->>'provider_message_id',j.provider_message_id),
    provider_accepted_at=COALESCE((p_patch->>'provider_accepted_at')::timestamptz,j.provider_accepted_at),
    last_error_code=p_patch->>'last_error_code'
    WHERE j.job_id=p_job_id AND j.claim_token=p_claim_token AND j.status='processing';
  RETURN FOUND;
END $$;
CREATE FUNCTION public.complete_signup_welcome_attempt(p_attempt_id uuid,p_outcome text,p_provider_key text,p_message_id text,p_error text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_job uuid;
BEGIN
  v_status := CASE p_outcome WHEN 'accepted' THEN 'accepted' WHEN 'ambiguous' THEN 'uncertain'
    WHEN 'transient' THEN 'released' WHEN 'permanent' THEN 'released' ELSE NULL END;
  IF v_status IS NULL THEN RAISE EXCEPTION 'invalid outcome'; END IF;
  UPDATE public.email_provider_submissions s SET status=v_status,completed_at=now(),provider_key=p_provider_key,
    provider_message_id=p_message_id,provider_accepted_at=CASE WHEN v_status='accepted' THEN now() END,outcome_code=p_error
    WHERE s.submission_attempt_id=p_attempt_id AND s.status='reserved' AND s.intake_welcome_job_id IS NOT NULL
    RETURNING s.intake_welcome_job_id INTO v_job;
  IF NOT FOUND THEN RETURN false; END IF;
  IF (SELECT count(DISTINCT s.provider_message_id) FROM public.email_provider_submissions s
    WHERE s.intake_welcome_job_id=v_job AND s.status='accepted') > 1 THEN
    UPDATE public.email_production_control SET sending_enabled=false,updated_at=now() WHERE singleton_id=1;
  END IF;
  RETURN true;
END $$;
-- Reconcile signed events both at webhook arrival and after provider acceptance.
CREATE FUNCTION public.reconcile_signup_welcome_events(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job public.lead_intake_welcome_jobs; v_event record; v_email text;
BEGIN
  SELECT * INTO v_job FROM public.lead_intake_welcome_jobs j WHERE j.job_id=p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.provider_message_id IS NULL THEN RETURN false; END IF;
  SELECT i.email_normalized INTO v_email FROM public.lead_intakes i WHERE i.intake_id=v_job.intake_id;
  FOR v_event IN SELECT * FROM public.email_provider_events e WHERE e.provider_key=v_job.provider_key
    AND e.provider_message_id=v_job.provider_message_id AND e.reconciled_at IS NULL FOR UPDATE LOOP
    IF v_event.suppression IN ('hard_bounce','complaint') THEN
      INSERT INTO public.email_suppressions(email_normalized,reason) VALUES(v_email,v_event.suppression) ON CONFLICT DO NOTHING;
    END IF;
    IF v_event.event_kind IN ('delivered','delayed','bounced','complained') THEN
      UPDATE public.lead_intake_welcome_jobs SET delivery_status=v_event.event_kind::public.email_delivery_status
        WHERE job_id=p_job_id AND (delivery_status IN ('pending','delayed') OR v_event.event_kind IN ('bounced','complained'));
    END IF;
    UPDATE public.email_provider_events SET reconciled_at=now(),matched_at=now() WHERE id=v_event.id;
  END LOOP;
  RETURN true;
END $$;

-- All new capabilities are server-only; no anonymous or authenticated RPC access.
REVOKE ALL ON FUNCTION public.enqueue_lead_intake_welcome() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resolve_signup_intake(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.exchange_signup_welcome(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.open_signup_existing_plan(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_signup_plan(text,uuid,text,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restart_completed_signup_plan(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_signup_welcome_jobs(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.begin_signup_welcome_attempt(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_signup_welcome_job(uuid,uuid,public.email_job_status,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_signup_welcome_attempt(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reconcile_signup_welcome_events(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_signup_intake(text),public.exchange_signup_welcome(text,text),
  public.open_signup_existing_plan(text,text),public.save_signup_plan(text,uuid,text,text,jsonb,jsonb,text),
  public.restart_completed_signup_plan(uuid,uuid,uuid,text,text),public.claim_signup_welcome_jobs(uuid,integer),
  public.begin_signup_welcome_attempt(uuid,uuid,uuid),public.finish_signup_welcome_job(uuid,uuid,public.email_job_status,jsonb),
  public.complete_signup_welcome_attempt(uuid,text,text,text,text),public.reconcile_signup_welcome_events(uuid) TO service_role;

-- Include due welcome jobs in existing scheduler health evidence.
CREATE OR REPLACE FUNCTION public.count_production_eligible_email_jobs()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ((
    SELECT count(*)
      FROM public.email_jobs job
      JOIN public.lead_plans lead ON lead.id = job.lead_plan_id
      CROSS JOIN public.email_production_control control
     WHERE control.singleton_id = 1
       AND control.sending_enabled
       AND control.activation_boundary IS NOT NULL
       AND job.created_at >= control.activation_boundary
       AND job.status IN ('pending', 'retry_scheduled', 'processing')
       AND job.eligible_at <= now()
       AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= now())
       AND (job.status <> 'processing' OR job.lease_expires_at IS NULL OR job.lease_expires_at <= now())
       AND (
         job.job_type = 'recovery'
         OR (
           lead.plan_email_consent_active
           AND lead.plan_email_consent_at IS NOT NULL
           AND job.created_at >= lead.plan_email_consent_at
         )
       )
       AND lead.email_suppressed_at IS NULL
       AND lead.email_suppression_reason IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions suppression
          WHERE suppression.email_normalized = lead.email_normalized
            AND suppression.reason IN ('hard_bounce', 'complaint')
       )
       AND (control.genuine_plans_admitted OR job.lead_plan_id = control.controlled_lead_plan_id)
  ) + (
    SELECT count(*)
      FROM public.paid_access_email_jobs job
      JOIN public.customer_accounts account ON account.id = job.customer_id
      JOIN public.paid_product_entitlements entitlement
        ON entitlement.id = job.entitlement_id
       AND entitlement.customer_id = job.customer_id
       AND entitlement.status = 'active'
      CROSS JOIN public.email_production_control control
     WHERE control.singleton_id = 1
       AND control.sending_enabled
       AND control.paid_access_sending_enabled
       AND control.activation_boundary IS NOT NULL
       AND job.created_at >= control.activation_boundary
       AND job.status IN ('pending', 'retry_scheduled', 'processing')
       AND job.eligible_at <= now()
       AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= now())
       AND (job.status <> 'processing' OR job.lease_expires_at IS NULL OR job.lease_expires_at <= now())
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions suppression
          WHERE suppression.email_normalized = account.email_normalized
            AND suppression.reason IN ('hard_bounce', 'complaint')
       )
       AND (
         control.paid_access_customers_admitted
         OR job.customer_id = control.controlled_paid_customer_id
       )
  ) + (
    SELECT count(*) FROM public.lead_intake_welcome_jobs j
      JOIN public.lead_intakes i ON i.intake_id=j.intake_id
      CROSS JOIN public.email_production_control c
    WHERE c.singleton_id=1 AND c.sending_enabled AND c.activation_boundary IS NOT NULL
      AND j.created_at >= c.activation_boundary
      AND j.status IN ('pending','retry_scheduled','processing')
      AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= now())
      AND (j.status <> 'processing' OR j.lease_expires_at <= now())
      AND (c.genuine_plans_admitted OR i.controlled_test)
      AND NOT EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.email_normalized=i.email_normalized AND s.reason IN ('hard_bounce','complaint'))
  ))::integer
$$;
