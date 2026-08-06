-- Final Rescue lifecycle checkpoint: forward-only migration.
--
-- Replaces three authoritative function bodies to add the Final Rescue job,
-- its re-anchoring, and its closure. Everything else in each function is
-- preserved: Plan Ready, Start Day 1, Halfway, Stalled, reassessment
-- cancellation, replay/conflict semantics, locking, grants, SECURITY DEFINER,
-- search_path, unique/index semantics, and all current return values.
--
-- No backfill. No provider send. No schema change.

CREATE OR REPLACE FUNCTION public.commit_plan_version(p_submission_id uuid, p_assessment jsonb, p_plan jsonb, p_session_token_hash text, p_request_fingerprint text, p_lead_plan_id uuid DEFAULT NULL::uuid, p_email_normalized text DEFAULT NULL::text, p_email_original text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_consent_copy text DEFAULT NULL::text, p_consent_version text DEFAULT NULL::text)
 RETURNS TABLE(lead_plan_id uuid, plan_version_id uuid, job_id uuid, first_name text, source text, replayed boolean, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

REVOKE ALL ON FUNCTION public.commit_plan_version(uuid, jsonb, jsonb, text, text, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_plan_version(uuid, jsonb, jsonb, text, text, uuid, text, text, text, text, text) TO service_role;


CREATE OR REPLACE FUNCTION public.mark_day_1_started(p_lead_plan_id uuid, p_plan_version_id uuid)
 RETURNS TABLE(started_at timestamp with time zone, newly_started boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Final Rescue re-anchoring on the first deliberate persisted Day 1 start.
    --
    -- Only this newly inserted-start branch reaches here, so a repeated or
    -- replayed start call can never move the horizon again. The same unsent
    -- Final Rescue job is re-anchored to the persisted started_at plus 5 days:
    -- no second job is created and no queued event is emitted.
    --
    -- Any in-flight lease is released and the job returns to pending, so a
    -- worker that claimed the job but has not yet attempted a provider send can
    -- never send against the stale pre-re-anchor horizon: its fenced writes
    -- fail on the cleared claim token.
    UPDATE public.email_jobs
       SET eligible_at = v_started_at + interval '5 days',
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
$function$;

REVOKE ALL ON FUNCTION public.mark_day_1_started(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_day_1_started(uuid, uuid) TO service_role;


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
