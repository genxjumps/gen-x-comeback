-- Gen X Jumps account recovery migration; release a60cf0be6a92b26a780badcb75680b7c7fbbdd17.
-- Prepared for separate application approval. The Git SQL is byte-exact.
BEGIN;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('gxj:account-recovery-migration',0));
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
LOCK TABLE public.email_production_control IN EXCLUSIVE MODE;
CREATE TEMP TABLE gxj_account_recovery_before ON COMMIT DROP AS SELECT encode(extensions.digest(((SELECT jsonb_agg(to_jsonb(c) ORDER BY singleton_id) FROM public.email_production_control c))::text,'sha256'),'hex') AS controls_hash;
DO $preconditions$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected migration role'; END IF;
 IF (SELECT jsonb_agg(to_jsonb(s) ORDER BY version) FROM (SELECT version,name,cardinality(statements) AS statement_count,encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex') AS sha256 FROM supabase_migrations.schema_migrations ORDER BY version
) s) IS DISTINCT FROM '[{"name":"dac1e850-6879-4f24-b504-c6106e595625","statement_count":1,"version":"20260730102818","sha256":"96fd737c209b3f577c90ef2ed717fdedfcb1175dab0a9193c907aaa7db385efb"},{"name":"12fd393b-c5b4-4d27-adaf-cd865c1e64a5","statement_count":1,"version":"20260731104508","sha256":"994cc85a8ecafce7080dee92cb77df89b6381106eda3c245e482ccc0de169a47"},{"name":"a72d192a-58e0-4026-9f92-c5eb04350ee6","statement_count":1,"version":"20260731111514","sha256":"4bc2543f2a5cad952e2c0abe5742db1a0d99b25bec6343f023a8e919c7d0ed7f"},{"name":"a1925d5a-e979-4287-8100-fe6ed8b75a08","statement_count":1,"version":"20260731113525","sha256":"f49f889eea06e58f437c997b3c6204c283e82774e137dc5bc6d02f0b65bc10be"},{"name":"2c598307-293f-497c-9c2a-a00d95aaae6d","statement_count":1,"version":"20260803005817","sha256":"8dd87c48f77a169cef2d3b93976b39d84a2bb7e0856d3840d447b882bdffd4a9"},{"name":"e668ac33-992e-48c2-900c-2c3a6b8eb0b6","statement_count":1,"version":"20260803012559","sha256":"a8587455c79030628293139cb28cb0e042adb406305d10b02cb42cf63763c225"},{"name":"start_day_1_job_foundation","statement_count":1,"version":"20260804000000","sha256":"8b81f774dba49ea0869d95f7f78a9cd58c4890d7f30ffa2ba850bd3a9a566332"},{"name":"day_1_start_state","statement_count":1,"version":"20260804010000","sha256":"ea60c39b89268d0fd9b9398b71f9140275a836be8c6f1e6f5f8f9e0099ceca12"},{"name":"72fcf5d0-0fe2-4135-b1e2-e7c9d3d93792","statement_count":1,"version":"20260805222359","sha256":"e3a7740fb892038539e3d3c8d16ef7ac22310413cdc86b5fcbc9da39062c02d2"},{"name":"08dbb52d-6821-4097-bbbb-871f0cea3038","statement_count":1,"version":"20260805223427","sha256":"d0cd43fd19954e3c6688140f8a6ce3141d969d2c749757b14591b7e19e751e29"},{"name":"ae470c60-e60f-4867-9203-3867538aafb8","statement_count":1,"version":"20260806002653","sha256":"76fbcd2b33fe681efae42d84d43b584eb598baf4f88730c619395639642983a6"},{"name":"bfb6db47-486a-4447-8985-6dfd022d80b6","statement_count":1,"version":"20260806103944","sha256":"b38fe2127aedf2306ac14f11d41b34ee961a0eecd85610b5a292ca42cf9e59ef"},{"name":"e395b63e-208d-4c34-b512-ecdcdd5e1c1c","statement_count":1,"version":"20260806121356","sha256":"23ab8d4ccdd443f15716435de2ac55737fa93210e6f227ff49bad854c3a08cc9"},{"name":"582a324d-47f9-44ac-aec4-1ad8b86eb7d6","statement_count":1,"version":"20260806175920","sha256":"7903c2b213fe5b00f8b1798053c0e14923b2a712932eb2d53a07ee9c5099a713"},{"name":"cd9cb476-5061-494a-a66e-8e10b0f31dd5","statement_count":1,"version":"20260806200433","sha256":"ae19c18d69cc248e3a0a04a3d8bc644431cf94540eafbbb630fa5e9617551112"},{"name":"e52c4b4b-1c81-4e87-828d-81e9e8db23c4","statement_count":1,"version":"20260806215657","sha256":"3bef3f2c67bea7674e5b2273e6295e7e1d16eb3d8170c11128b065fff6d73b4d"},{"name":"0f99de9f-07b7-46cf-909e-1b97a7ff8137","statement_count":1,"version":"20260806224437","sha256":"9df4441dce5bd764cbd27b537f8d43e15838235849d04529c1613012926876fe"},{"name":"0a429511-3eac-46f0-a264-bc1bbbe34551","statement_count":1,"version":"20260806235258","sha256":"a23d93f745c29f3d858fde9c74077b90d7ef9d2e9a04157faa1f5c85c74eb63b"},{"name":"630a998c-8645-4bfa-9f21-e0c0166d673e","statement_count":1,"version":"20260807175301","sha256":"8fb45716b82e4fbdcbc66b27316772950e319474e5e3d5f9df7865d6af968b1f"},{"name":"d05c3c18-8f7e-4fad-8fe9-339088db91b4","statement_count":1,"version":"20260807175318","sha256":"fa79821999f2a48a9562f923e1e2c382019266eb43a59879b12f116374a32c8d"},{"name":"72978a70-fadf-41c5-be5f-4977c645896a","statement_count":1,"version":"20260807180632","sha256":"f0ae98a52261d3f826a527a9111ef3590a423c2a38ebfecf2cb854874be6b8ff"},{"name":"d9ff7846-f2b9-4587-9326-9a5e142a2056","statement_count":1,"version":"20260807180709","sha256":"aeed05216c81c55f3ba6a3e3b54e5bbbf430e2e24a3cd00f4fb31583821bb610"},{"name":"4d5f0f64-0a61-4ee4-bf12-3a1f3d50f92e","statement_count":0,"version":"20260807193000","sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},{"name":"mailerlite_marketing_sync","statement_count":1,"version":"20260828150000","sha256":"898976d1448e1c84950171a1a56c4d75b39e54fa5c00f64f5c17a29b32c71527"},{"name":"customer_account_foundation","statement_count":1,"version":"20260828170000","sha256":"f90fee89d873658b498bb84bf4edefac61135bddf6a3f98dc584c7db15c9c660"},{"name":"accelerator_enrollment_progress","statement_count":1,"version":"20260828180000","sha256":"38506c0a1598da9a50d1943e9e42188ba508a8a213240495437ec6c4f7910148"},{"name":"recovery_transactional_claim_contract","statement_count":1,"version":"20260902183000","sha256":"2f0178ba1157754393757a5f2c0b125b09968984244f3866b9545f39238669f2"},{"name":"program_week_measurement_reminders","statement_count":1,"version":"20260904100000","sha256":"fab376fb454f9919b8de28c793211b3bc4c4daf98209dfeb34a5c2bbba4e95c0"},{"name":"customer_program_reminder_preferences","statement_count":1,"version":"20260904110000","sha256":"23203519865ebb0a66461a01d2d1b75a4eab29e28c7b342903539823bed89ebe"},{"name":"private_customer_progress_admins","statement_count":1,"version":"20260904120000","sha256":"4034d44adf35db2b787e2052bb328bac83a7a8156af28282b1981ebedb9b23ea"},{"name":"customer_nutrition_profiles","statement_count":1,"version":"20260904140000","sha256":"5f0bcb8019b823c8540dfd5d0ce48ac2d753a54adbb110ea2cba7ae4d0fbfd93"},{"name":"fix_accelerator_ownership_lock_separator","statement_count":1,"version":"20260905170000","sha256":"33642a2914d615d5ba34cb898888534e6ed0a23308de1db576989a6ee54719b8"},{"name":"fix_accelerator_run_number_ambiguity","statement_count":1,"version":"20260905180000","sha256":"5871f921944cfb8873456c0d3bdf99ee532be3f1a44ce4b5086510970409d365"},{"name":"accelerator_guest_checkout_handoffs","statement_count":1,"version":"20260905190000","sha256":"07fa55662a7548dad225dad9cda735cd77e41a07f307501755f477d917123f4d"},{"name":"paid_access_email_recovery","statement_count":1,"version":"20260906100000","sha256":"9dd097527dd30f84da9b60a62d8429aee98372ae32199f76c33d5e810b3fb8cb"},{"name":"website_lead_intake_handoff","statement_count":1,"version":"20260907210000","sha256":"d3381405528439c97dde7b4d3e8da9dc9779a6ef3e53bd4473c8f53dbbf5817b"},{"name":"lead_plan_calendar_access","statement_count":1,"version":"20260909161000","sha256":"681deb7bd0f1b5e9b526d9ea72f0a524e62bc4cd6eaaa39c49afa846749901a8"},{"name":"seven_day_signup_recovery","statement_count":1,"version":"20260909190000","sha256":"a9a7d6a980875602100a8994deccef406162535976d58804e0f054f34be665e6"},{"name":"accelerator_refund_requests","statement_count":1,"version":"20260910100000","sha256":"604ce6c148d5e605f9b74621c2c540b3cdda4deb82c68f8cbdbfcd474dabfa8d"},{"name":"accelerator_refund_permissions","statement_count":1,"version":"20260910110000","sha256":"f44c4a4e09c6ae1919fc9260d677626b3d46d84bbe84dc2224963d0120750e23"}]'::jsonb THEN RAISE EXCEPTION 'Migration ledger drift'; END IF;
 IF encode(extensions.digest(((SELECT jsonb_agg(to_jsonb(s) ORDER BY kind,key) FROM (SELECT 'function' AS kind,p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS key,
jsonb_build_object('source_md5',md5(p.prosrc),'language',l.lanname,'security_definer',p.prosecdef,'config',p.proconfig,'result',pg_get_function_result(p.oid),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service',has_function_privilege('service_role',p.oid,'EXECUTE')) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
UNION ALL SELECT 'table',c.relname,jsonb_build_object('rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'anon_select',has_table_privilege('anon',c.oid,'SELECT'),'auth_select',has_table_privilege('authenticated',c.oid,'SELECT'),'service_select',has_table_privilege('service_role',c.oid,'SELECT'),'service_insert',has_table_privilege('service_role',c.oid,'INSERT'),'service_update',has_table_privilege('service_role',c.oid,'UPDATE'),'service_delete',has_table_privilege('service_role',c.oid,'DELETE'))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'column',table_name||'.'||column_name,jsonb_build_object('type',udt_name,'nullable',is_nullable,'default',column_default)
FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'constraint',c.relname||'.'||co.conname,jsonb_build_object('definition',pg_get_constraintdef(co.oid))
FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE co.contype<>'n' AND n.nspname='public' AND c.relname IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'index',tablename||'.'||indexname,jsonb_build_object('definition',indexdef) FROM pg_indexes WHERE schemaname='public' AND tablename IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'policy',tablename||'.'||policyname,jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) FROM pg_policies WHERE schemaname='public' AND tablename IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'trigger',c.relname||'.'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname='public' AND c.relname IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
ORDER BY kind,key
) s))::text,'sha256'),'hex') IS DISTINCT FROM '669eb39064a2dbfdbe52693da5dc3aa04bbc7a39a8cecac5d13f38da43736023' THEN RAISE EXCEPTION 'Schema drift'; END IF;
 IF encode(extensions.digest(((SELECT jsonb_agg(to_jsonb(s) ORDER BY owner,schema,type,grantee,privilege_type) FROM (SELECT pg_get_userbyid(d.defaclrole) AS owner,n.nspname AS schema,d.defaclobjtype AS type,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,pg_get_userbyid(a.grantor) AS grantor,a.privilege_type,a.is_grantable
FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE n.nspname='public' ORDER BY owner,schema,type,grantee,privilege_type
) s))::text,'sha256'),'hex') IS DISTINCT FROM '39f188a5dcf50ec57ced7cabec5e514d177182569d92c8374378e5183c08f1a1' THEN RAISE EXCEPTION 'Default privilege drift'; END IF;
 IF encode(extensions.digest(((SELECT jsonb_agg(to_jsonb(s) ORDER BY singleton_id) FROM (SELECT singleton_id,sending_enabled,genuine_plans_admitted,provider_submission_limit,paid_access_sending_enabled,paid_access_customers_admitted,controlled_lead_plan_id,controlled_paid_customer_id,activation_boundary FROM public.email_production_control ORDER BY singleton_id
) s))::text,'sha256'),'hex') IS DISTINCT FROM '9636f7fc53cfd0b562e600243c11de1a551fbc6487ad1f5168973324a6ca05c8' THEN RAISE EXCEPTION 'Operational control drift'; END IF;
 IF EXISTS(SELECT 1 FROM public.paid_purchases WHERE purchase_source='stripe_checkout' AND source_reference NOT LIKE 'cs_test_%') THEN RAISE EXCEPTION 'Non-test purchase found'; END IF;
 IF EXISTS(SELECT 1 FROM public.paid_access_email_jobs WHERE status='processing' AND lease_expires_at > now()) THEN RAISE EXCEPTION 'Paid worker still processing'; END IF;
END $preconditions$;
UPDATE public.email_production_control SET paid_access_sending_enabled=false WHERE singleton_id=1;
-- Account recovery establishes identity, never paid ownership.
-- Existing entitlement-bound purchase and legacy recovery credentials keep their fences.
ALTER TABLE public.paid_access_email_jobs ALTER COLUMN entitlement_id DROP NOT NULL;
ALTER TABLE public.paid_access_tokens ALTER COLUMN entitlement_id DROP NOT NULL;
ALTER TABLE public.paid_access_email_jobs ADD CONSTRAINT paid_access_job_scope_check
  CHECK (entitlement_id IS NOT NULL OR job_type = 'paid_recovery');

CREATE OR REPLACE FUNCTION public.enqueue_paid_access_job(
  p_job_type text,
  p_customer_id uuid,
  p_entitlement_id uuid,
  p_idempotency_key text,
  p_eligible_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF p_job_type NOT IN ('paid_purchase_access', 'paid_recovery')
    OR p_customer_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.customer_accounts WHERE id = p_customer_id)
    OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0
    OR NOT (
      (p_job_type = 'paid_recovery' AND p_entitlement_id IS NULL)
      OR EXISTS (
      SELECT 1 FROM public.paid_product_entitlements entitlement
       WHERE entitlement.id = p_entitlement_id
         AND entitlement.customer_id = p_customer_id
         AND entitlement.status = 'active'
      )
    )
  THEN RETURN NULL; END IF;

  INSERT INTO public.paid_access_email_jobs (
    job_type, job_version, template_version, customer_id, entitlement_id,
    idempotency_key, eligible_at, status
  ) VALUES (
    p_job_type, 'v1', 'paid_access_v1', p_customer_id, p_entitlement_id,
    p_idempotency_key, COALESCE(p_eligible_at, now()), 'pending'
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING job_id INTO v_job_id;

  IF v_job_id IS NOT NULL THEN
    INSERT INTO public.paid_access_email_events (
      event_name, job_id, customer_id, entitlement_id
    ) VALUES (
      CASE WHEN p_job_type = 'paid_purchase_access'
        THEN 'paid_purchase_access_queued' ELSE 'paid_recovery_queued' END,
      v_job_id, p_customer_id, p_entitlement_id
    );
  END IF;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_customer_access_recovery(
  p_email_normalized text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  IF p_email_normalized IS NULL
    OR p_email_normalized <> lower(btrim(p_email_normalized))
    OR length(p_email_normalized) NOT BETWEEN 3 AND 254
    OR p_request_id IS NULL OR length(btrim(p_request_id)) = 0
  THEN RETURN; END IF;

  SELECT account.id INTO v_customer_id
    FROM public.customer_accounts account
   WHERE account.email_normalized = p_email_normalized
   LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    PERFORM public.enqueue_paid_access_job(
      'paid_recovery', v_customer_id, NULL,
      'paid_recovery:' || v_customer_id::text || ':' || p_request_id || ':v1', now()
    );
    RETURN;
  END IF;

  PERFORM public.request_plan_recovery(p_email_normalized, p_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_production_paid_access_email_jobs(
  p_job_type text,
  p_invocation_id uuid,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.paid_access_email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control public.email_production_control;
  v_remaining integer;
BEGIN
  IF p_job_type NOT IN ('paid_purchase_access', 'paid_recovery') OR NOT EXISTS (
    SELECT 1 FROM public.email_scheduler_invocations invocation
     WHERE invocation.invocation_id = p_invocation_id
       AND invocation.authenticated_at IS NOT NULL
       AND invocation.completed_at IS NULL
  ) THEN RETURN; END IF;

  SELECT * INTO v_control FROM public.email_production_control WHERE singleton_id = 1;
  IF NOT COALESCE(v_control.sending_enabled, false)
    OR NOT COALESCE(v_control.paid_access_sending_enabled, false)
    OR v_control.activation_boundary IS NULL
  THEN RETURN; END IF;

  SELECT v_control.provider_submission_limit
    - (SELECT count(*) FROM public.email_provider_submissions submission
        WHERE submission.reserved_at >= now() - interval '24 hours'
          AND submission.status IN ('reserved', 'accepted', 'uncertain'))
    INTO v_remaining;
  IF v_remaining <= 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH due AS (
    SELECT job.job_id
      FROM public.paid_access_email_jobs job
      JOIN public.customer_accounts account ON account.id = job.customer_id
      LEFT JOIN public.paid_product_entitlements entitlement
        ON entitlement.id = job.entitlement_id
       AND entitlement.customer_id = job.customer_id
       AND entitlement.status = 'active'
     WHERE ((job.job_type = 'paid_recovery' AND job.entitlement_id IS NULL)
         OR entitlement.id IS NOT NULL)
       AND job.job_type = p_job_type
       AND job.status IN ('pending', 'retry_scheduled', 'processing')
       AND job.created_at >= v_control.activation_boundary
       AND job.eligible_at <= now()
       AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= now())
       AND (job.status <> 'processing' OR job.lease_expires_at IS NULL OR job.lease_expires_at <= now())
       AND (
         v_control.paid_access_customers_admitted
         OR job.customer_id = v_control.controlled_paid_customer_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions suppression
          WHERE suppression.email_normalized = account.email_normalized
            AND suppression.reason IN ('hard_bounce', 'complaint')
       )
     ORDER BY COALESCE(job.next_attempt_at, job.eligible_at), job.created_at, job.job_id
     FOR UPDATE OF job SKIP LOCKED
     LIMIT LEAST(GREATEST(p_limit, 0), v_remaining)
  )
  UPDATE public.paid_access_email_jobs job
     SET status = 'processing',
         attempt_count = job.attempt_count + 1,
         locked_at = now(),
         lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
         claim_token = gen_random_uuid(),
         updated_at = now()
    FROM due
   WHERE job.job_id = due.job_id
  RETURNING job.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_production_paid_access_provider_attempt(
  p_job_id uuid,
  p_claim_token uuid,
  p_invocation_id uuid,
  p_attempted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.paid_access_email_jobs;
  v_account public.customer_accounts;
  v_control public.email_production_control;
  v_count integer;
  v_attempt_id uuid;
BEGIN
  SELECT * INTO v_job FROM public.paid_access_email_jobs
   WHERE job_id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status <> 'processing'
    OR v_job.claim_token IS NULL OR v_job.claim_token <> p_claim_token
  THEN RETURN jsonb_build_object('outcome', 'lost_lease'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.email_scheduler_invocations invocation
     WHERE invocation.invocation_id = p_invocation_id
       AND invocation.authenticated_at IS NOT NULL
       AND invocation.completed_at IS NULL
  ) THEN RETURN jsonb_build_object('outcome', 'authentication_blocked'); END IF;

  SELECT * INTO v_control FROM public.email_production_control
   WHERE singleton_id = 1 FOR UPDATE;
  IF NOT COALESCE(v_control.sending_enabled, false)
    OR NOT COALESCE(v_control.paid_access_sending_enabled, false)
  THEN RETURN jsonb_build_object('outcome', 'sending_disabled'); END IF;
  IF v_control.activation_boundary IS NULL OR v_job.created_at < v_control.activation_boundary
  THEN RETURN jsonb_build_object('outcome', 'activation_blocked'); END IF;
  IF NOT v_control.paid_access_customers_admitted
    AND v_job.customer_id IS DISTINCT FROM v_control.controlled_paid_customer_id
  THEN RETURN jsonb_build_object('outcome', 'controlled_scope_blocked'); END IF;
  IF NOT (v_job.job_type = 'paid_recovery' AND v_job.entitlement_id IS NULL)
    AND NOT EXISTS (
    SELECT 1 FROM public.paid_product_entitlements entitlement
     WHERE entitlement.id = v_job.entitlement_id
       AND entitlement.customer_id = v_job.customer_id
       AND entitlement.status = 'active'
  ) THEN RETURN jsonb_build_object('outcome', 'entitlement_blocked'); END IF;

  SELECT * INTO v_account FROM public.customer_accounts
   WHERE id = v_job.customer_id FOR SHARE;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.email_suppressions suppression
     WHERE suppression.email_normalized = v_account.email_normalized
       AND suppression.reason IN ('hard_bounce', 'complaint')
  ) THEN RETURN jsonb_build_object('outcome', 'suppression_blocked'); END IF;

  SELECT count(*) INTO v_count FROM public.email_provider_submissions submission
    WHERE submission.reserved_at >= p_attempted_at - interval '24 hours'
      AND submission.status IN ('reserved', 'accepted', 'uncertain');
  IF v_count >= v_control.provider_submission_limit
  THEN RETURN jsonb_build_object('outcome', 'limit_reached'); END IF;

  INSERT INTO public.email_provider_submissions (
    invocation_id, paid_access_job_id, customer_id, job_type, template_version,
    idempotency_key, reserved_at
  ) VALUES (
    p_invocation_id, v_job.job_id, v_job.customer_id, v_job.job_type,
    v_job.template_version, v_job.idempotency_key, p_attempted_at
  ) RETURNING submission_attempt_id INTO v_attempt_id;

  UPDATE public.paid_access_email_jobs
     SET first_provider_attempt_at = COALESCE(first_provider_attempt_at, p_attempted_at),
         updated_at = now()
   WHERE job_id = p_job_id AND claim_token = p_claim_token AND status = 'processing';

  RETURN jsonb_build_object('outcome', 'ok', 'submission_attempt_id', v_attempt_id);
END;
$$;

-- CREATE OR REPLACE retains existing ACLs. Reassert the service-only boundary.
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
      LEFT JOIN public.paid_product_entitlements entitlement
        ON entitlement.id = job.entitlement_id
       AND entitlement.customer_id = job.customer_id
       AND entitlement.status = 'active'
      CROSS JOIN public.email_production_control control
     WHERE ((job.job_type = 'paid_recovery' AND job.entitlement_id IS NULL)
         OR entitlement.id IS NOT NULL)
       AND control.singleton_id = 1
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

REVOKE ALL ON FUNCTION public.enqueue_paid_access_job(text, uuid, uuid, text, timestamptz),
 public.request_customer_access_recovery(text,text),
 public.claim_production_paid_access_email_jobs(text,uuid,integer,integer),
 public.begin_production_paid_access_provider_attempt(uuid,uuid,uuid,timestamptz)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_paid_access_job(text, uuid, uuid, text, timestamptz),
 public.request_customer_access_recovery(text,text),
 public.claim_production_paid_access_email_jobs(text,uuid,integer,integer),
 public.begin_production_paid_access_provider_attempt(uuid,uuid,uuid,timestamptz)
 TO service_role;

-- Read-only catalog assertions, reusable after application. No test rows are created.
DO $$
DECLARE t record; f record; r text; privilege text; count_tables integer:=0; count_functions integer:=0;
BEGIN
  FOR t IN SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN
      ('accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
  LOOP
    count_tables:=count_tables+1;
    IF NOT t.relrowsecurity THEN RAISE EXCEPTION 'RLS missing: %',t.relname; END IF;
    IF EXISTS(SELECT 1 FROM aclexplode(COALESCE(t.relacl,acldefault('r',t.relowner))) a
      WHERE a.grantee<>t.relowner AND
      (a.grantee<>(SELECT oid FROM pg_roles WHERE rolname='service_role')
       OR a.privilege_type NOT IN ('SELECT','INSERT','UPDATE') OR a.is_grantable))
    THEN RAISE EXCEPTION 'Unexpected table grant: %',t.relname; END IF;
    IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t.oid AND attacl IS NOT NULL)
    THEN RAISE EXCEPTION 'Unexpected column grant: %',t.relname; END IF;
    FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE'] LOOP
      IF NOT has_table_privilege('service_role',t.oid,privilege) THEN
        RAISE EXCEPTION 'Runtime permission missing: % %',t.relname,privilege;
      END IF;
    END LOOP;
    FOREACH privilege IN ARRAY ARRAY['DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('service_role',t.oid,privilege) THEN
        RAISE EXCEPTION 'Excess runtime permission: % %',t.relname,privilege;
      END IF;
    END LOOP;
    FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','sandbox_exec') LOOP
      FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(r,t.oid,privilege) THEN RAISE EXCEPTION 'Excess access: % % %',r,t.relname,privilege; END IF;
      END LOOP;
    END LOOP;
    IF (SELECT count(*) FROM pg_policy WHERE polrelid=t.oid)<>1 OR NOT EXISTS(
      SELECT 1 FROM pg_policy WHERE polrelid=t.oid AND polname='service_role_only'
      AND polcmd='*' AND polpermissive AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='service_role')]
      AND pg_get_expr(polqual,polrelid)='true' AND pg_get_expr(polwithcheck,polrelid)='true'
    ) THEN RAISE EXCEPTION 'Unexpected RLS policy: %',t.relname; END IF;
  END LOOP;
  IF count_tables<>3 THEN RAISE EXCEPTION 'Expected three refund tables'; END IF;
  FOR f IN SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('request_accelerator_refund','get_accelerator_refund_purchases',
      'get_accelerator_refund_queue','confirm_accelerator_full_refund')
  LOOP
    count_functions:=count_functions+1;
    IF NOT f.prosecdef OR f.proconfig IS DISTINCT FROM ARRAY['search_path=public']
      OR NOT has_function_privilege('service_role',f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Unsafe function: %',f.proname; END IF;
    IF EXISTS(SELECT 1 FROM aclexplode(COALESCE(f.proacl,acldefault('f',f.proowner))) a
      WHERE a.grantee<>f.proowner AND
      (a.grantee<>(SELECT oid FROM pg_roles WHERE rolname='service_role') OR a.is_grantable))
    THEN RAISE EXCEPTION 'Unexpected function grant: %',f.proname; END IF;
    FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','sandbox_exec') LOOP
      IF has_function_privilege(r,f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Excess RPC access: % %',r,f.proname; END IF;
    END LOOP;
  END LOOP;
  IF count_functions<>4 THEN RAISE EXCEPTION 'Expected four refund functions'; END IF;
END $$;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20260910170000','account_recovery_without_ownership',ARRAY['-- Account recovery establishes identity, never paid ownership.
-- Existing entitlement-bound purchase and legacy recovery credentials keep their fences.
ALTER TABLE public.paid_access_email_jobs ALTER COLUMN entitlement_id DROP NOT NULL;
ALTER TABLE public.paid_access_tokens ALTER COLUMN entitlement_id DROP NOT NULL;
ALTER TABLE public.paid_access_email_jobs ADD CONSTRAINT paid_access_job_scope_check
  CHECK (entitlement_id IS NOT NULL OR job_type = ''paid_recovery'');

CREATE OR REPLACE FUNCTION public.enqueue_paid_access_job(
  p_job_type text,
  p_customer_id uuid,
  p_entitlement_id uuid,
  p_idempotency_key text,
  p_eligible_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF p_job_type NOT IN (''paid_purchase_access'', ''paid_recovery'')
    OR p_customer_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.customer_accounts WHERE id = p_customer_id)
    OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0
    OR NOT (
      (p_job_type = ''paid_recovery'' AND p_entitlement_id IS NULL)
      OR EXISTS (
      SELECT 1 FROM public.paid_product_entitlements entitlement
       WHERE entitlement.id = p_entitlement_id
         AND entitlement.customer_id = p_customer_id
         AND entitlement.status = ''active''
      )
    )
  THEN RETURN NULL; END IF;

  INSERT INTO public.paid_access_email_jobs (
    job_type, job_version, template_version, customer_id, entitlement_id,
    idempotency_key, eligible_at, status
  ) VALUES (
    p_job_type, ''v1'', ''paid_access_v1'', p_customer_id, p_entitlement_id,
    p_idempotency_key, COALESCE(p_eligible_at, now()), ''pending''
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING job_id INTO v_job_id;

  IF v_job_id IS NOT NULL THEN
    INSERT INTO public.paid_access_email_events (
      event_name, job_id, customer_id, entitlement_id
    ) VALUES (
      CASE WHEN p_job_type = ''paid_purchase_access''
        THEN ''paid_purchase_access_queued'' ELSE ''paid_recovery_queued'' END,
      v_job_id, p_customer_id, p_entitlement_id
    );
  END IF;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_customer_access_recovery(
  p_email_normalized text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  IF p_email_normalized IS NULL
    OR p_email_normalized <> lower(btrim(p_email_normalized))
    OR length(p_email_normalized) NOT BETWEEN 3 AND 254
    OR p_request_id IS NULL OR length(btrim(p_request_id)) = 0
  THEN RETURN; END IF;

  SELECT account.id INTO v_customer_id
    FROM public.customer_accounts account
   WHERE account.email_normalized = p_email_normalized
   LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    PERFORM public.enqueue_paid_access_job(
      ''paid_recovery'', v_customer_id, NULL,
      ''paid_recovery:'' || v_customer_id::text || '':'' || p_request_id || '':v1'', now()
    );
    RETURN;
  END IF;

  PERFORM public.request_plan_recovery(p_email_normalized, p_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_production_paid_access_email_jobs(
  p_job_type text,
  p_invocation_id uuid,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.paid_access_email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control public.email_production_control;
  v_remaining integer;
BEGIN
  IF p_job_type NOT IN (''paid_purchase_access'', ''paid_recovery'') OR NOT EXISTS (
    SELECT 1 FROM public.email_scheduler_invocations invocation
     WHERE invocation.invocation_id = p_invocation_id
       AND invocation.authenticated_at IS NOT NULL
       AND invocation.completed_at IS NULL
  ) THEN RETURN; END IF;

  SELECT * INTO v_control FROM public.email_production_control WHERE singleton_id = 1;
  IF NOT COALESCE(v_control.sending_enabled, false)
    OR NOT COALESCE(v_control.paid_access_sending_enabled, false)
    OR v_control.activation_boundary IS NULL
  THEN RETURN; END IF;

  SELECT v_control.provider_submission_limit
    - (SELECT count(*) FROM public.email_provider_submissions submission
        WHERE submission.reserved_at >= now() - interval ''24 hours''
          AND submission.status IN (''reserved'', ''accepted'', ''uncertain''))
    INTO v_remaining;
  IF v_remaining <= 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH due AS (
    SELECT job.job_id
      FROM public.paid_access_email_jobs job
      JOIN public.customer_accounts account ON account.id = job.customer_id
      LEFT JOIN public.paid_product_entitlements entitlement
        ON entitlement.id = job.entitlement_id
       AND entitlement.customer_id = job.customer_id
       AND entitlement.status = ''active''
     WHERE ((job.job_type = ''paid_recovery'' AND job.entitlement_id IS NULL)
         OR entitlement.id IS NOT NULL)
       AND job.job_type = p_job_type
       AND job.status IN (''pending'', ''retry_scheduled'', ''processing'')
       AND job.created_at >= v_control.activation_boundary
       AND job.eligible_at <= now()
       AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= now())
       AND (job.status <> ''processing'' OR job.lease_expires_at IS NULL OR job.lease_expires_at <= now())
       AND (
         v_control.paid_access_customers_admitted
         OR job.customer_id = v_control.controlled_paid_customer_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions suppression
          WHERE suppression.email_normalized = account.email_normalized
            AND suppression.reason IN (''hard_bounce'', ''complaint'')
       )
     ORDER BY COALESCE(job.next_attempt_at, job.eligible_at), job.created_at, job.job_id
     FOR UPDATE OF job SKIP LOCKED
     LIMIT LEAST(GREATEST(p_limit, 0), v_remaining)
  )
  UPDATE public.paid_access_email_jobs job
     SET status = ''processing'',
         attempt_count = job.attempt_count + 1,
         locked_at = now(),
         lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 1)),
         claim_token = gen_random_uuid(),
         updated_at = now()
    FROM due
   WHERE job.job_id = due.job_id
  RETURNING job.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_production_paid_access_provider_attempt(
  p_job_id uuid,
  p_claim_token uuid,
  p_invocation_id uuid,
  p_attempted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.paid_access_email_jobs;
  v_account public.customer_accounts;
  v_control public.email_production_control;
  v_count integer;
  v_attempt_id uuid;
BEGIN
  SELECT * INTO v_job FROM public.paid_access_email_jobs
   WHERE job_id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status <> ''processing''
    OR v_job.claim_token IS NULL OR v_job.claim_token <> p_claim_token
  THEN RETURN jsonb_build_object(''outcome'', ''lost_lease''); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.email_scheduler_invocations invocation
     WHERE invocation.invocation_id = p_invocation_id
       AND invocation.authenticated_at IS NOT NULL
       AND invocation.completed_at IS NULL
  ) THEN RETURN jsonb_build_object(''outcome'', ''authentication_blocked''); END IF;

  SELECT * INTO v_control FROM public.email_production_control
   WHERE singleton_id = 1 FOR UPDATE;
  IF NOT COALESCE(v_control.sending_enabled, false)
    OR NOT COALESCE(v_control.paid_access_sending_enabled, false)
  THEN RETURN jsonb_build_object(''outcome'', ''sending_disabled''); END IF;
  IF v_control.activation_boundary IS NULL OR v_job.created_at < v_control.activation_boundary
  THEN RETURN jsonb_build_object(''outcome'', ''activation_blocked''); END IF;
  IF NOT v_control.paid_access_customers_admitted
    AND v_job.customer_id IS DISTINCT FROM v_control.controlled_paid_customer_id
  THEN RETURN jsonb_build_object(''outcome'', ''controlled_scope_blocked''); END IF;
  IF NOT (v_job.job_type = ''paid_recovery'' AND v_job.entitlement_id IS NULL)
    AND NOT EXISTS (
    SELECT 1 FROM public.paid_product_entitlements entitlement
     WHERE entitlement.id = v_job.entitlement_id
       AND entitlement.customer_id = v_job.customer_id
       AND entitlement.status = ''active''
  ) THEN RETURN jsonb_build_object(''outcome'', ''entitlement_blocked''); END IF;

  SELECT * INTO v_account FROM public.customer_accounts
   WHERE id = v_job.customer_id FOR SHARE;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.email_suppressions suppression
     WHERE suppression.email_normalized = v_account.email_normalized
       AND suppression.reason IN (''hard_bounce'', ''complaint'')
  ) THEN RETURN jsonb_build_object(''outcome'', ''suppression_blocked''); END IF;

  SELECT count(*) INTO v_count FROM public.email_provider_submissions submission
    WHERE submission.reserved_at >= p_attempted_at - interval ''24 hours''
      AND submission.status IN (''reserved'', ''accepted'', ''uncertain'');
  IF v_count >= v_control.provider_submission_limit
  THEN RETURN jsonb_build_object(''outcome'', ''limit_reached''); END IF;

  INSERT INTO public.email_provider_submissions (
    invocation_id, paid_access_job_id, customer_id, job_type, template_version,
    idempotency_key, reserved_at
  ) VALUES (
    p_invocation_id, v_job.job_id, v_job.customer_id, v_job.job_type,
    v_job.template_version, v_job.idempotency_key, p_attempted_at
  ) RETURNING submission_attempt_id INTO v_attempt_id;

  UPDATE public.paid_access_email_jobs
     SET first_provider_attempt_at = COALESCE(first_provider_attempt_at, p_attempted_at),
         updated_at = now()
   WHERE job_id = p_job_id AND claim_token = p_claim_token AND status = ''processing'';

  RETURN jsonb_build_object(''outcome'', ''ok'', ''submission_attempt_id'', v_attempt_id);
END;
$$;

-- CREATE OR REPLACE retains existing ACLs. Reassert the service-only boundary.
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
       AND job.status IN (''pending'', ''retry_scheduled'', ''processing'')
       AND job.eligible_at <= now()
       AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= now())
       AND (job.status <> ''processing'' OR job.lease_expires_at IS NULL OR job.lease_expires_at <= now())
       AND (
         job.job_type = ''recovery''
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
            AND suppression.reason IN (''hard_bounce'', ''complaint'')
       )
       AND (control.genuine_plans_admitted OR job.lead_plan_id = control.controlled_lead_plan_id)
  ) + (
    SELECT count(*)
      FROM public.paid_access_email_jobs job
      JOIN public.customer_accounts account ON account.id = job.customer_id
      LEFT JOIN public.paid_product_entitlements entitlement
        ON entitlement.id = job.entitlement_id
       AND entitlement.customer_id = job.customer_id
       AND entitlement.status = ''active''
      CROSS JOIN public.email_production_control control
     WHERE ((job.job_type = ''paid_recovery'' AND job.entitlement_id IS NULL)
         OR entitlement.id IS NOT NULL)
       AND control.singleton_id = 1
       AND control.sending_enabled
       AND control.paid_access_sending_enabled
       AND control.activation_boundary IS NOT NULL
       AND job.created_at >= control.activation_boundary
       AND job.status IN (''pending'', ''retry_scheduled'', ''processing'')
       AND job.eligible_at <= now()
       AND (job.next_attempt_at IS NULL OR job.next_attempt_at <= now())
       AND (job.status <> ''processing'' OR job.lease_expires_at IS NULL OR job.lease_expires_at <= now())
       AND NOT EXISTS (
         SELECT 1 FROM public.email_suppressions suppression
          WHERE suppression.email_normalized = account.email_normalized
            AND suppression.reason IN (''hard_bounce'', ''complaint'')
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
      AND j.status IN (''pending'',''retry_scheduled'',''processing'')
      AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= now())
      AND (j.status <> ''processing'' OR j.lease_expires_at <= now())
      AND (c.genuine_plans_admitted OR i.controlled_test)
      AND NOT EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.email_normalized=i.email_normalized AND s.reason IN (''hard_bounce'',''complaint''))
  ))::integer
$$;

REVOKE ALL ON FUNCTION public.enqueue_paid_access_job(text, uuid, uuid, text, timestamptz),
 public.request_customer_access_recovery(text,text),
 public.claim_production_paid_access_email_jobs(text,uuid,integer,integer),
 public.begin_production_paid_access_provider_attempt(uuid,uuid,uuid,timestamptz)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_paid_access_job(text, uuid, uuid, text, timestamptz),
 public.request_customer_access_recovery(text,text),
 public.claim_production_paid_access_email_jobs(text,uuid,integer,integer),
 public.begin_production_paid_access_provider_attempt(uuid,uuid,uuid,timestamptz)
 TO service_role;
']);
DO $postconditions$
BEGIN
 IF (SELECT jsonb_agg(to_jsonb(s) ORDER BY version) FROM (SELECT version,name,cardinality(statements) AS statement_count,encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex') AS sha256 FROM supabase_migrations.schema_migrations ORDER BY version
) s) IS DISTINCT FROM '[{"name":"dac1e850-6879-4f24-b504-c6106e595625","statement_count":1,"version":"20260730102818","sha256":"96fd737c209b3f577c90ef2ed717fdedfcb1175dab0a9193c907aaa7db385efb"},{"name":"12fd393b-c5b4-4d27-adaf-cd865c1e64a5","statement_count":1,"version":"20260731104508","sha256":"994cc85a8ecafce7080dee92cb77df89b6381106eda3c245e482ccc0de169a47"},{"name":"a72d192a-58e0-4026-9f92-c5eb04350ee6","statement_count":1,"version":"20260731111514","sha256":"4bc2543f2a5cad952e2c0abe5742db1a0d99b25bec6343f023a8e919c7d0ed7f"},{"name":"a1925d5a-e979-4287-8100-fe6ed8b75a08","statement_count":1,"version":"20260731113525","sha256":"f49f889eea06e58f437c997b3c6204c283e82774e137dc5bc6d02f0b65bc10be"},{"name":"2c598307-293f-497c-9c2a-a00d95aaae6d","statement_count":1,"version":"20260803005817","sha256":"8dd87c48f77a169cef2d3b93976b39d84a2bb7e0856d3840d447b882bdffd4a9"},{"name":"e668ac33-992e-48c2-900c-2c3a6b8eb0b6","statement_count":1,"version":"20260803012559","sha256":"a8587455c79030628293139cb28cb0e042adb406305d10b02cb42cf63763c225"},{"name":"start_day_1_job_foundation","statement_count":1,"version":"20260804000000","sha256":"8b81f774dba49ea0869d95f7f78a9cd58c4890d7f30ffa2ba850bd3a9a566332"},{"name":"day_1_start_state","statement_count":1,"version":"20260804010000","sha256":"ea60c39b89268d0fd9b9398b71f9140275a836be8c6f1e6f5f8f9e0099ceca12"},{"name":"72fcf5d0-0fe2-4135-b1e2-e7c9d3d93792","statement_count":1,"version":"20260805222359","sha256":"e3a7740fb892038539e3d3c8d16ef7ac22310413cdc86b5fcbc9da39062c02d2"},{"name":"08dbb52d-6821-4097-bbbb-871f0cea3038","statement_count":1,"version":"20260805223427","sha256":"d0cd43fd19954e3c6688140f8a6ce3141d969d2c749757b14591b7e19e751e29"},{"name":"ae470c60-e60f-4867-9203-3867538aafb8","statement_count":1,"version":"20260806002653","sha256":"76fbcd2b33fe681efae42d84d43b584eb598baf4f88730c619395639642983a6"},{"name":"bfb6db47-486a-4447-8985-6dfd022d80b6","statement_count":1,"version":"20260806103944","sha256":"b38fe2127aedf2306ac14f11d41b34ee961a0eecd85610b5a292ca42cf9e59ef"},{"name":"e395b63e-208d-4c34-b512-ecdcdd5e1c1c","statement_count":1,"version":"20260806121356","sha256":"23ab8d4ccdd443f15716435de2ac55737fa93210e6f227ff49bad854c3a08cc9"},{"name":"582a324d-47f9-44ac-aec4-1ad8b86eb7d6","statement_count":1,"version":"20260806175920","sha256":"7903c2b213fe5b00f8b1798053c0e14923b2a712932eb2d53a07ee9c5099a713"},{"name":"cd9cb476-5061-494a-a66e-8e10b0f31dd5","statement_count":1,"version":"20260806200433","sha256":"ae19c18d69cc248e3a0a04a3d8bc644431cf94540eafbbb630fa5e9617551112"},{"name":"e52c4b4b-1c81-4e87-828d-81e9e8db23c4","statement_count":1,"version":"20260806215657","sha256":"3bef3f2c67bea7674e5b2273e6295e7e1d16eb3d8170c11128b065fff6d73b4d"},{"name":"0f99de9f-07b7-46cf-909e-1b97a7ff8137","statement_count":1,"version":"20260806224437","sha256":"9df4441dce5bd764cbd27b537f8d43e15838235849d04529c1613012926876fe"},{"name":"0a429511-3eac-46f0-a264-bc1bbbe34551","statement_count":1,"version":"20260806235258","sha256":"a23d93f745c29f3d858fde9c74077b90d7ef9d2e9a04157faa1f5c85c74eb63b"},{"name":"630a998c-8645-4bfa-9f21-e0c0166d673e","statement_count":1,"version":"20260807175301","sha256":"8fb45716b82e4fbdcbc66b27316772950e319474e5e3d5f9df7865d6af968b1f"},{"name":"d05c3c18-8f7e-4fad-8fe9-339088db91b4","statement_count":1,"version":"20260807175318","sha256":"fa79821999f2a48a9562f923e1e2c382019266eb43a59879b12f116374a32c8d"},{"name":"72978a70-fadf-41c5-be5f-4977c645896a","statement_count":1,"version":"20260807180632","sha256":"f0ae98a52261d3f826a527a9111ef3590a423c2a38ebfecf2cb854874be6b8ff"},{"name":"d9ff7846-f2b9-4587-9326-9a5e142a2056","statement_count":1,"version":"20260807180709","sha256":"aeed05216c81c55f3ba6a3e3b54e5bbbf430e2e24a3cd00f4fb31583821bb610"},{"name":"4d5f0f64-0a61-4ee4-bf12-3a1f3d50f92e","statement_count":0,"version":"20260807193000","sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},{"name":"mailerlite_marketing_sync","statement_count":1,"version":"20260828150000","sha256":"898976d1448e1c84950171a1a56c4d75b39e54fa5c00f64f5c17a29b32c71527"},{"name":"customer_account_foundation","statement_count":1,"version":"20260828170000","sha256":"f90fee89d873658b498bb84bf4edefac61135bddf6a3f98dc584c7db15c9c660"},{"name":"accelerator_enrollment_progress","statement_count":1,"version":"20260828180000","sha256":"38506c0a1598da9a50d1943e9e42188ba508a8a213240495437ec6c4f7910148"},{"name":"recovery_transactional_claim_contract","statement_count":1,"version":"20260902183000","sha256":"2f0178ba1157754393757a5f2c0b125b09968984244f3866b9545f39238669f2"},{"name":"program_week_measurement_reminders","statement_count":1,"version":"20260904100000","sha256":"fab376fb454f9919b8de28c793211b3bc4c4daf98209dfeb34a5c2bbba4e95c0"},{"name":"customer_program_reminder_preferences","statement_count":1,"version":"20260904110000","sha256":"23203519865ebb0a66461a01d2d1b75a4eab29e28c7b342903539823bed89ebe"},{"name":"private_customer_progress_admins","statement_count":1,"version":"20260904120000","sha256":"4034d44adf35db2b787e2052bb328bac83a7a8156af28282b1981ebedb9b23ea"},{"name":"customer_nutrition_profiles","statement_count":1,"version":"20260904140000","sha256":"5f0bcb8019b823c8540dfd5d0ce48ac2d753a54adbb110ea2cba7ae4d0fbfd93"},{"name":"fix_accelerator_ownership_lock_separator","statement_count":1,"version":"20260905170000","sha256":"33642a2914d615d5ba34cb898888534e6ed0a23308de1db576989a6ee54719b8"},{"name":"fix_accelerator_run_number_ambiguity","statement_count":1,"version":"20260905180000","sha256":"5871f921944cfb8873456c0d3bdf99ee532be3f1a44ce4b5086510970409d365"},{"name":"accelerator_guest_checkout_handoffs","statement_count":1,"version":"20260905190000","sha256":"07fa55662a7548dad225dad9cda735cd77e41a07f307501755f477d917123f4d"},{"name":"paid_access_email_recovery","statement_count":1,"version":"20260906100000","sha256":"9dd097527dd30f84da9b60a62d8429aee98372ae32199f76c33d5e810b3fb8cb"},{"name":"website_lead_intake_handoff","statement_count":1,"version":"20260907210000","sha256":"d3381405528439c97dde7b4d3e8da9dc9779a6ef3e53bd4473c8f53dbbf5817b"},{"name":"lead_plan_calendar_access","statement_count":1,"version":"20260909161000","sha256":"681deb7bd0f1b5e9b526d9ea72f0a524e62bc4cd6eaaa39c49afa846749901a8"},{"name":"seven_day_signup_recovery","statement_count":1,"version":"20260909190000","sha256":"a9a7d6a980875602100a8994deccef406162535976d58804e0f054f34be665e6"},{"name":"accelerator_refund_requests","statement_count":1,"version":"20260910100000","sha256":"604ce6c148d5e605f9b74621c2c540b3cdda4deb82c68f8cbdbfcd474dabfa8d"},{"name":"accelerator_refund_permissions","statement_count":1,"version":"20260910110000","sha256":"f44c4a4e09c6ae1919fc9260d677626b3d46d84bbe84dc2224963d0120750e23"},{"version":"20260910170000","name":"account_recovery_without_ownership","statement_count":1,"sha256":"91b3e22b73019ea7e82dd9cca666819ec31ab88c0a50846f6077a94a9845f7a6"}]'::jsonb THEN RAISE EXCEPTION 'Migration ledger drift'; END IF;
 IF encode(extensions.digest(((SELECT jsonb_agg(to_jsonb(s) ORDER BY kind,key) FROM (SELECT 'function' AS kind,p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS key,
jsonb_build_object('source_md5',md5(p.prosrc),'language',l.lanname,'security_definer',p.prosecdef,'config',p.proconfig,'result',pg_get_function_result(p.oid),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service',has_function_privilege('service_role',p.oid,'EXECUTE')) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
UNION ALL SELECT 'table',c.relname,jsonb_build_object('rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'anon_select',has_table_privilege('anon',c.oid,'SELECT'),'auth_select',has_table_privilege('authenticated',c.oid,'SELECT'),'service_select',has_table_privilege('service_role',c.oid,'SELECT'),'service_insert',has_table_privilege('service_role',c.oid,'INSERT'),'service_update',has_table_privilege('service_role',c.oid,'UPDATE'),'service_delete',has_table_privilege('service_role',c.oid,'DELETE'))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'column',table_name||'.'||column_name,jsonb_build_object('type',udt_name,'nullable',is_nullable,'default',column_default)
FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'constraint',c.relname||'.'||co.conname,jsonb_build_object('definition',pg_get_constraintdef(co.oid))
FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE co.contype<>'n' AND n.nspname='public' AND c.relname IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'index',tablename||'.'||indexname,jsonb_build_object('definition',indexdef) FROM pg_indexes WHERE schemaname='public' AND tablename IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'policy',tablename||'.'||policyname,jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) FROM pg_policies WHERE schemaname='public' AND tablename IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
UNION ALL SELECT 'trigger',c.relname||'.'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname='public' AND c.relname IN ('paid_purchases','paid_product_entitlements','paid_program_enrollments','customer_active_programs','paid_access_tokens','customer_accounts','paid_access_email_jobs','accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
ORDER BY kind,key
) s))::text,'sha256'),'hex') IS DISTINCT FROM 'f0949d0ecbb1842cc874ba5c283ad905795726d0cca976adf12eb8088f96550e' THEN RAISE EXCEPTION 'Unexpected resulting schema'; END IF;
 IF encode(extensions.digest(((SELECT jsonb_agg(to_jsonb(s) ORDER BY owner,schema,type,grantee,privilege_type) FROM (SELECT pg_get_userbyid(d.defaclrole) AS owner,n.nspname AS schema,d.defaclobjtype AS type,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,pg_get_userbyid(a.grantor) AS grantor,a.privilege_type,a.is_grantable
FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE n.nspname='public' ORDER BY owner,schema,type,grantee,privilege_type
) s))::text,'sha256'),'hex') IS DISTINCT FROM '39f188a5dcf50ec57ced7cabec5e514d177182569d92c8374378e5183c08f1a1' THEN RAISE EXCEPTION 'Global defaults changed'; END IF;
 IF (SELECT paid_access_sending_enabled FROM public.email_production_control WHERE singleton_id=1) THEN RAISE EXCEPTION 'Paid sending not paused'; END IF;
 IF encode(extensions.digest((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('paid_access_sending_enabled',true) ORDER BY singleton_id) FROM public.email_production_control c)::text,'sha256'),'hex') IS DISTINCT FROM (SELECT controls_hash FROM gxj_account_recovery_before) THEN RAISE EXCEPTION 'Other operational controls changed'; END IF;

END $postconditions$;
COMMIT;
