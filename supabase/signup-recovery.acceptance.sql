-- Isolated-database behavioral checks. Never run against a linked backend.
BEGIN;
DO $$
DECLARE i uuid; i2 uuid; lp uuid; ver uuid; s uuid := gen_random_uuid(); res jsonb; r record;
  plan jsonb := jsonb_build_object('days',(SELECT jsonb_agg(jsonb_build_object('day',d,'title','Test')) FROM generate_series(1,7)d));
  inv uuid := gen_random_uuid(); job public.lead_intake_welcome_jobs; attempt jsonb; n integer;
BEGIN
  INSERT INTO public.lead_intakes(token_hash,email_normalized,email_original,first_name,consent_copy,consent_version,expires_at,controlled_test)
    VALUES(repeat('a',64),'signup@example.test','signup@example.test','Test','both','v1',now()+interval '1 day',true) RETURNING intake_id INTO i;
  IF (SELECT count(*) FROM public.lead_intake_welcome_jobs WHERE intake_id=i) <> 1 THEN RAISE EXCEPTION 'welcome outbox missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.lead_plans WHERE email_normalized='signup@example.test') THEN RAISE EXCEPTION 'premature plan'; END IF;
  BEGIN
    PERFORM public.save_signup_plan(repeat('a',64),s,repeat('b',64),'first','{}',plan,'Invalid/Zone');
    RAISE EXCEPTION 'invalid calendar unexpectedly saved';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'invalid plan timezone' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.lead_plans WHERE email_normalized='signup@example.test') THEN RAISE EXCEPTION 'partial save escaped rollback'; END IF;
  res := public.save_signup_plan(repeat('a',64),s,repeat('b',64),'first','{}',plan,'America/New_York');
  IF res->>'outcome' <> 'saved' THEN RAISE EXCEPTION 'first save failed %',res; END IF;
  SELECT id,plan_version_id INTO lp,ver FROM public.lead_plans WHERE email_normalized='signup@example.test';
  res := public.save_signup_plan(repeat('a',64),s,repeat('b',64),'first','{}',plan,'America/New_York');
  IF res->>'replayed' <> 'true' THEN RAISE EXCEPTION 'save retry not idempotent'; END IF;
  IF (SELECT count(*) FROM public.email_jobs WHERE lead_plan_id=lp AND job_type='plan_ready')<>1 THEN RAISE EXCEPTION 'duplicate plan ready'; END IF;
  INSERT INTO public.lead_plan_day_completions(lead_plan_id,day_number) VALUES(lp,1);
  UPDATE public.lead_plans SET plan_email_consent_active=false,marketing_consent_active=false WHERE id=lp;
  INSERT INTO public.lead_intakes(token_hash,email_normalized,email_original,first_name,consent_copy,consent_version,expires_at,controlled_test)
    VALUES(repeat('c',64),'signup@example.test','signup@example.test','Other','both','v1',now()+interval '1 day',true) RETURNING intake_id INTO i2;
  IF (SELECT count(*) FROM public.lead_intake_welcome_jobs)<>1 THEN RAISE EXCEPTION 'rapid repeat queued duplicate welcome'; END IF;
  res := public.save_signup_plan(repeat('c',64),gen_random_uuid(),repeat('d',64),'different','{"q1":"different"}',plan,'UTC');
  IF res->>'outcome'<>'resume' THEN RAISE EXCEPTION 'existing save not routed to resume'; END IF;
  IF (SELECT plan_version_id FROM public.lead_plans WHERE id=lp)<>ver OR NOT EXISTS(SELECT 1 FROM public.lead_plan_day_completions WHERE lead_plan_id=lp AND day_number=1) THEN RAISE EXCEPTION 'repeat signup replaced progress'; END IF;
  IF EXISTS(SELECT 1 FROM public.plan_access_sessions WHERE token_hash=repeat('d',64)) THEN RAISE EXCEPTION 'email-only signup leaked access'; END IF;
  IF public.open_signup_existing_plan(repeat('c',64),repeat('e',64)) THEN RAISE EXCEPTION 'plain handoff granted access'; END IF;
  UPDATE public.lead_intake_welcome_jobs SET token_hash=repeat('f',64),token_expires_at=now()+interval '30 days' WHERE intake_id=i;
  IF NOT public.exchange_signup_welcome(repeat('f',64),repeat('1',64)) OR NOT public.exchange_signup_welcome(repeat('f',64),repeat('2',64)) THEN RAISE EXCEPTION 'portable exchange failed'; END IF;
  IF NOT public.open_signup_existing_plan(repeat('1',64),repeat('3',64)) OR NOT public.open_signup_existing_plan(repeat('2',64),repeat('4',64)) THEN RAISE EXCEPTION 'email access failed'; END IF;
  IF (SELECT count(*) FROM public.return_link_sessions WHERE lead_plan_id=lp AND revoked_at IS NULL)<>2 THEN RAISE EXCEPTION 'sessions invalidated'; END IF;
  IF public.restart_completed_signup_plan(lp,ver,gen_random_uuid(),repeat('5',64),'UTC') THEN RAISE EXCEPTION 'incomplete plan restarted'; END IF;
  INSERT INTO public.lead_plan_day_completions(lead_plan_id,day_number) SELECT lp,d FROM generate_series(2,7)d;
  res := public.save_signup_plan(repeat('c',64),gen_random_uuid(),repeat('d',64),'different','{"q1":"different"}',plan,'UTC');
  IF (SELECT count(*) FROM public.lead_plan_day_completions WHERE lead_plan_id=lp)<>7 THEN RAISE EXCEPTION 'completed plan silently restarted'; END IF;
  s := gen_random_uuid();
  IF NOT public.restart_completed_signup_plan(lp,ver,s,repeat('5',64),'UTC') THEN RAISE EXCEPTION 'explicit restart failed'; END IF;
  IF NOT public.restart_completed_signup_plan(lp,ver,s,repeat('5',64),'UTC') THEN RAISE EXCEPTION 'restart retry failed'; END IF;
  IF public.restart_completed_signup_plan(lp,ver,gen_random_uuid(),repeat('6',64),'UTC') THEN RAISE EXCEPTION 'stale restart accepted'; END IF;
  IF (SELECT count(*) FROM public.lead_plan_completed_runs WHERE lead_plan_id=lp)<>1 OR EXISTS(SELECT 1 FROM public.lead_plan_day_completions WHERE lead_plan_id=lp) THEN RAISE EXCEPTION 'restart history/progress wrong'; END IF;
  IF (SELECT count(*) FROM public.lead_plans WHERE email_normalized='signup@example.test')<>1 THEN RAISE EXCEPTION 'duplicate identity'; END IF;
  -- The original welcome link follows current state, including a newer run.
  IF NOT public.open_signup_existing_plan(repeat('2',64),repeat('7',64)) THEN RAISE EXCEPTION 'old welcome stranded participant'; END IF;
  UPDATE public.lead_intake_welcome_jobs SET token_expires_at=now()-interval '1 second' WHERE intake_id=i;
  IF public.exchange_signup_welcome(repeat('f',64),repeat('8',64)) THEN RAISE EXCEPTION 'expired email token accepted'; END IF;

  IF EXISTS(SELECT 1 FROM public.lead_plans WHERE id=lp AND (plan_email_consent_active OR marketing_consent_active)) THEN RAISE EXCEPTION 'recovery or restart altered consent'; END IF;

  -- Controlled dispatch: no invocation, closed gate, scope, suppression and cap.
  SELECT count(*) INTO n FROM public.claim_signup_welcome_jobs(inv,10);
  IF n<>0 THEN RAISE EXCEPTION 'unauthenticated dispatch'; END IF;
  INSERT INTO public.email_scheduler_invocations(invocation_id,auth_deadline,authenticated_at) VALUES(inv,now()+interval '1 minute',now());
  SELECT count(*) INTO n FROM public.claim_signup_welcome_jobs(inv,10);
  IF n<>0 THEN RAISE EXCEPTION 'disabled dispatch'; END IF;
  UPDATE public.email_production_control SET sending_enabled=true,activation_boundary=now()-interval '1 day',provider_submission_limit=1 WHERE singleton_id=1;
  SELECT * INTO job FROM public.claim_signup_welcome_jobs(inv,1);
  IF job.job_id IS NULL THEN RAISE EXCEPTION 'controlled job not claimed'; END IF;
  UPDATE public.lead_intakes SET controlled_test=false WHERE intake_id=job.intake_id;
  attempt := public.begin_signup_welcome_attempt(job.job_id,job.claim_token,inv);
  IF attempt->>'outcome'<>'controlled_scope_blocked' THEN RAISE EXCEPTION 'scope fence failed'; END IF;
  UPDATE public.lead_intakes SET controlled_test=true WHERE intake_id=job.intake_id;
  INSERT INTO public.email_suppressions(email_normalized,reason) VALUES('signup@example.test','complaint');
  attempt := public.begin_signup_welcome_attempt(job.job_id,job.claim_token,inv);
  IF attempt->>'outcome'<>'suppression_blocked' THEN RAISE EXCEPTION 'suppression fence failed'; END IF;
  DELETE FROM public.email_suppressions WHERE email_normalized='signup@example.test';
  attempt := public.begin_signup_welcome_attempt(job.job_id,job.claim_token,inv);
  IF attempt->>'outcome'<>'ok' THEN RAISE EXCEPTION 'attempt reservation failed %',attempt; END IF;
  IF (public.begin_signup_welcome_attempt(job.job_id,job.claim_token,inv)->>'outcome')<>'limit_reached' THEN RAISE EXCEPTION 'shared cap exceeded'; END IF;
  PERFORM public.complete_signup_welcome_attempt((attempt->>'submission_attempt_id')::uuid,'accepted','fake','message-1',NULL);
  IF NOT public.finish_signup_welcome_job(job.job_id,job.claim_token,'provider_accepted','{"provider_key":"fake","provider_message_id":"message-1"}') THEN RAISE EXCEPTION 'finish failed'; END IF;
  IF public.finish_signup_welcome_job(job.job_id,job.claim_token,'provider_accepted','{}') THEN RAISE EXCEPTION 'lease reused'; END IF;
  -- New RPCs remain private.
  IF has_function_privilege('anon','public.save_signup_plan(text,uuid,text,text,jsonb,jsonb,text)','EXECUTE') OR
    has_function_privilege('authenticated','public.restart_completed_signup_plan(uuid,uuid,uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'public mutation privilege'; END IF;
END $$;
ROLLBACK;
