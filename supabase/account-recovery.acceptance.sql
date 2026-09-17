-- Disposable full-replay database only. All fixtures and reservations roll back.
BEGIN;
DO $$
DECLARE c uuid:=gen_random_uuid(); empty_c uuid:=gen_random_uuid(); inv uuid:=gen_random_uuid();
 e uuid; p uuid; j public.paid_access_email_jobs; r record; before_history jsonb; result jsonb;
BEGIN
 INSERT INTO auth.users(id) VALUES(c),(empty_c);
 INSERT INTO public.customer_accounts(id,auth_user_id,email_normalized,email_original,email_verified_at)
 VALUES(c,c,'account-refund@example.test','account-refund@example.test',now()),
 (empty_c,empty_c,'account-empty@example.test','account-empty@example.test',now());
 SELECT * INTO r FROM public.provision_accelerator_ownership(c,'cs_test_accountrecovery',repeat('9',64),'stripe_checkout','cs_test_accountrecovery',now(),'accelerator_28',3700,'USD');
 e:=r.entitlement_id; p:=r.purchase_id;
 PERFORM public.request_accelerator_refund(c,p);
 result:=public.confirm_accelerator_full_refund('cs_test_accountrecovery','ch_account',3700,'USD',ARRAY['re_account']);
 IF result->>'outcome'<>'refunded' THEN RAISE EXCEPTION 'refund fixture failed'; END IF;
 before_history:=public.get_accelerator_refund_purchases(c);
 PERFORM public.request_customer_access_recovery('account-refund@example.test','account-request');
 PERFORM public.request_customer_access_recovery('account-refund@example.test','account-request');
 IF (SELECT count(*) FROM public.paid_access_email_jobs WHERE customer_id=c AND job_type='paid_recovery')<>1
 THEN RAISE EXCEPTION 'recovery missing or duplicated'; END IF;
 IF public.enqueue_paid_access_job('paid_purchase_access',c,NULL,'invalid-purchase',now()) IS NOT NULL
 OR public.enqueue_paid_access_job('paid_purchase_access',c,e,'revoked-purchase',now()) IS NOT NULL
 THEN RAISE EXCEPTION 'purchase fence removed'; END IF;
 PERFORM public.request_customer_access_recovery('account-empty@example.test','empty-request');
 IF NOT EXISTS(SELECT 1 FROM public.paid_access_email_jobs WHERE customer_id=empty_c AND entitlement_id IS NULL AND job_type='paid_recovery')
 THEN RAISE EXCEPTION 'account-only recovery missing'; END IF;
 PERFORM public.request_customer_access_recovery('unknown-account@example.test','unknown-request');
 IF EXISTS(SELECT 1 FROM public.customer_accounts WHERE email_normalized='unknown-account@example.test')
 THEN RAISE EXCEPTION 'unknown signup created'; END IF;
 INSERT INTO public.email_scheduler_invocations(invocation_id,auth_deadline,authenticated_at)
 VALUES(inv,now()+interval '1 minute',now());
 UPDATE public.email_production_control SET sending_enabled=true,paid_access_sending_enabled=true,
 activation_boundary=now()-interval '1 day',provider_submission_limit=25,
 paid_access_customers_admitted=false,controlled_paid_customer_id=c WHERE singleton_id=1;
 IF public.count_production_eligible_email_jobs()<>1 THEN RAISE EXCEPTION 'eligible recovery count wrong'; END IF;
 SELECT * INTO j FROM public.claim_production_paid_access_email_jobs('paid_recovery',inv,25,120);
 IF j.customer_id IS DISTINCT FROM c OR j.entitlement_id IS NOT NULL THEN RAISE EXCEPTION 'account recovery claim failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.paid_access_email_jobs WHERE customer_id=empty_c AND status='processing')
 THEN RAISE EXCEPTION 'controlled scope bypass'; END IF;
 UPDATE public.email_production_control SET paid_access_sending_enabled=false WHERE singleton_id=1;
 result:=public.begin_production_paid_access_provider_attempt(j.job_id,j.claim_token,inv,now());
 IF result->>'outcome'<>'sending_disabled' THEN RAISE EXCEPTION 'sending fence bypass'; END IF;
 UPDATE public.email_production_control SET paid_access_sending_enabled=true WHERE singleton_id=1;
 INSERT INTO public.email_suppressions(email_normalized,reason) VALUES('account-refund@example.test','complaint');
 result:=public.begin_production_paid_access_provider_attempt(j.job_id,j.claim_token,inv,now());
 IF result->>'outcome'<>'suppression_blocked' THEN RAISE EXCEPTION 'suppression bypass'; END IF;
 DELETE FROM public.email_suppressions WHERE email_normalized='account-refund@example.test';
 result:=public.begin_production_paid_access_provider_attempt(j.job_id,j.claim_token,inv,now());
 IF result->>'outcome'<>'ok' THEN RAISE EXCEPTION 'refunded recovery dispatch blocked: %',result; END IF;
 UPDATE public.email_production_control SET provider_submission_limit=1 WHERE singleton_id=1;
 result:=public.begin_production_paid_access_provider_attempt(j.job_id,j.claim_token,inv,now());
 IF result->>'outcome'<>'limit_reached' THEN RAISE EXCEPTION 'provider ceiling bypass'; END IF;
 INSERT INTO public.paid_access_tokens(customer_id,entitlement_id,job_id,token_hash,issued_at,expires_at)
 VALUES(c,NULL,j.job_id,repeat('8',64),now(),now()+interval '1 day');
 IF public.get_accelerator_refund_purchases(c)<>before_history
 OR (SELECT status FROM public.paid_product_entitlements WHERE id=e)<>'revoked'
 OR (SELECT status FROM public.paid_purchases WHERE id=p)<>'refunded'
 THEN RAISE EXCEPTION 'recovery changed purchase access or history'; END IF;
 IF (SELECT count(*) FROM public.customer_accounts WHERE id IN(c,empty_c))<>2
 THEN RAISE EXCEPTION 'identity changed'; END IF;
END $$;
ROLLBACK;
