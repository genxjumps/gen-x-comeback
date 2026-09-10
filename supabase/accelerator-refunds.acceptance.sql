-- Real transaction behavior against disposable fixtures only.
DO $$
DECLARE c uuid:=gen_random_uuid(); other_c uuid:=gen_random_uuid(); r jsonb; p uuid; e uuid; n uuid; old_n uuid;
 p2 uuid; e2 uuid; snapshot jsonb; request_time timestamptz; result_row record;
BEGIN
 INSERT INTO auth.users(id) VALUES(c),(other_c);
 INSERT INTO public.customer_accounts(id,auth_user_id,email_normalized,email_original,email_verified_at) VALUES(c,c,'refund@example.test','refund@example.test',now()),(other_c,other_c,'other@example.test','other@example.test',now());
 SELECT * INTO result_row FROM public.provision_accelerator_ownership(c,'cs_test_refund',repeat('a',64),'stripe_checkout','cs_test_refund',now(),'accelerator_28',3700,'USD');
 p:=result_row.purchase_id;e:=result_row.entitlement_id;
 IF p IS NULL OR e IS NULL THEN RAISE EXCEPTION 'provision failed'; END IF;
 IF public.get_accelerator_refund_queue(c) IS NOT NULL THEN RAISE EXCEPTION 'review queue leaked'; END IF;
 INSERT INTO public.private_customer_progress_admins(customer_id) VALUES(c);
 IF public.get_accelerator_refund_queue(c) IS NOT NULL THEN RAISE EXCEPTION 'progress admin gained refund access'; END IF;
 IF public.request_accelerator_refund(other_c,p)->>'outcome'<>'unavailable' THEN RAISE EXCEPTION 'cross-account request accepted'; END IF;
 IF jsonb_array_length(public.get_accelerator_refund_purchases(other_c))<>0 THEN RAISE EXCEPTION 'cross-account read'; END IF;
 r:=public.request_accelerator_refund(c,p);
 IF r->>'outcome'<>'received' THEN RAISE EXCEPTION 'request failed'; END IF;
 SELECT requested_at INTO request_time FROM public.accelerator_refund_requests WHERE purchase_id=p;
 IF public.request_accelerator_refund(c,p)<>r THEN RAISE EXCEPTION 'request not idempotent'; END IF;
 IF (SELECT status FROM public.paid_product_entitlements WHERE id=e)<>'active' THEN RAISE EXCEPTION 'request revoked access'; END IF;
 INSERT INTO public.private_refund_reviewers(customer_id) VALUES(c);
 IF jsonb_array_length(public.get_accelerator_refund_queue(c))<>1 THEN RAISE EXCEPTION 'review queue missing request'; END IF;
 -- Deadline comes from purchase, not program start or client clock. A timely
 -- request still replays after expiry without changing its recorded timestamp.
 UPDATE public.paid_purchases SET purchased_at=now()-interval '8 days',refund_request_deadline_at=now()-interval '1 day' WHERE id=p;
 IF public.request_accelerator_refund(c,p)<>r OR (SELECT requested_at FROM public.accelerator_refund_requests WHERE purchase_id=p)<>request_time THEN RAISE EXCEPTION 'timely request lost on retry'; END IF;
 SELECT * INTO result_row FROM public.provision_accelerator_ownership(other_c,'cs_test_expired',repeat('b',64),'stripe_checkout','cs_test_expired',now()-interval '8 days','accelerator_28',3700,'USD');
 IF public.request_accelerator_refund(other_c,result_row.purchase_id)->>'outcome'<>'ineligible' THEN RAISE EXCEPTION 'late request accepted'; END IF;
 -- Simulate a current active run and retain both progress and measurements.
 snapshot:=jsonb_build_object('productCode','accelerator_28','programVersion','accelerator_28_v1','days',jsonb_build_array(jsonb_build_object('day',1)));
 INSERT INTO public.paid_program_enrollments(customer_id,entitlement_id,product_code,program_version,program_snapshot,run_number,customer_time_zone,status,started_at)
 VALUES(c,e,'accelerator_28','accelerator_28_v1',snapshot,1,'America/New_York','active',now()) RETURNING id INTO n;
 INSERT INTO public.customer_active_programs(customer_id,program_kind,paid_enrollment_id) VALUES(c,'paid_run',n);
 INSERT INTO public.paid_program_day_completions(enrollment_id,program_version,day_number,completed_at) VALUES(n,'accelerator_28_v1',1,now());
 INSERT INTO public.customer_measurements(customer_id,enrollment_id,measurement_kind,value,unit,measurement_context)
 VALUES(c,n,'weight',175,'lb','starting');
 IF public.confirm_accelerator_full_refund('cs_test_refund','ch_refund',1000,'USD',ARRAY['re_one'])->>'outcome'<>'invalid' THEN RAISE EXCEPTION 'partial confirmation accepted'; END IF;
 IF public.confirm_accelerator_full_refund('cs_test_missing','ch_missing',3700,'USD',ARRAY['re_missing'])->>'outcome'<>'purchase_pending' THEN RAISE EXCEPTION 'missing purchase acknowledged'; END IF;
 IF public.confirm_accelerator_full_refund('cs_test_refund','ch_refund',3700,'USD',ARRAY['re_one','re_one'])->>'outcome'<>'invalid' THEN RAISE EXCEPTION 'duplicate refund IDs accepted'; END IF;
 r:=public.confirm_accelerator_full_refund('cs_test_refund','ch_refund',3700,'USD',ARRAY['re_one']);
 IF r->>'outcome'<>'refunded' THEN RAISE EXCEPTION 'refund failed'; END IF;
 IF (SELECT status FROM public.paid_purchases WHERE id=p)<>'refunded' OR (SELECT status FROM public.paid_product_entitlements WHERE id=e)<>'revoked' THEN RAISE EXCEPTION 'refund status failed'; END IF;
 IF (SELECT count(*) FROM public.customer_measurements WHERE customer_id=c AND value=175 AND status='active')<>1 THEN RAISE EXCEPTION 'measurement lost'; END IF;
 IF EXISTS(SELECT 1 FROM public.customer_active_programs WHERE customer_id=c) THEN RAISE EXCEPTION 'active pointer retained'; END IF;
 IF (SELECT status FROM public.paid_program_enrollments WHERE id=n)<>'revoked' OR (SELECT program_snapshot FROM public.paid_program_enrollments WHERE id=n)<>snapshot OR (SELECT count(*) FROM public.paid_program_day_completions WHERE enrollment_id=n)<>1 THEN RAISE EXCEPTION 'history lost'; END IF;
 IF public.confirm_accelerator_full_refund('cs_test_refund','ch_refund',3700,'USD',ARRAY['re_one'])->>'outcome'<>'replayed' THEN RAISE EXCEPTION 'refund not idempotent'; END IF;
 SELECT * INTO result_row FROM public.provision_accelerator_ownership(c,'cs_test_refund',repeat('a',64),'stripe_checkout','cs_test_refund',now(),'accelerator_28',3700,'USD');
 IF result_row.outcome<>'refunded_or_inactive' THEN RAISE EXCEPTION 'checkout replay restored access'; END IF;
 -- Repurchase creates access; an old delayed refund cannot take it away.
 SELECT * INTO result_row FROM public.provision_accelerator_ownership(c,'cs_test_repurchase',repeat('c',64),'stripe_checkout','cs_test_repurchase',now(),'accelerator_28',3700,'USD');
 p2:=result_row.purchase_id;e2:=result_row.entitlement_id;
 PERFORM public.confirm_accelerator_full_refund('cs_test_refund','ch_refund',3700,'USD',ARRAY['re_one']);
 IF (SELECT status FROM public.paid_product_entitlements WHERE id=e2)<>'active' OR (SELECT purchase_id FROM public.paid_product_entitlements WHERE id=e2)<>p2 THEN RAISE EXCEPTION 'old refund revoked repurchase'; END IF;
 -- First late event, not merely duplicate: rebind after a newer purchase.
 SELECT * INTO result_row FROM public.provision_accelerator_ownership(c,'cs_test_newest',repeat('d',64),'stripe_checkout','cs_test_newest',now(),'accelerator_28',3700,'USD');
 PERFORM public.confirm_accelerator_full_refund('cs_test_repurchase','ch_old',3700,'USD',ARRAY['re_old']);
 IF (SELECT purchase_id FROM public.paid_product_entitlements WHERE id=e2)<>result_row.purchase_id OR (SELECT status FROM public.paid_product_entitlements WHERE id=e2)<>'active' THEN RAISE EXCEPTION 'late first event revoked new purchase'; END IF;
 IF (SELECT count(*) FROM public.accelerator_refund_requests WHERE purchase_id=p)<>1 THEN RAISE EXCEPTION 'duplicate request'; END IF;
 IF (SELECT count(*) FROM public.email_provider_submissions)<>0 THEN RAISE EXCEPTION 'provider contacted'; END IF;
END $$;
-- Browser roles cannot bypass server identity binding or invoke confirmation.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers'] LOOP
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||t)::regclass)
 OR has_table_privilege('anon','public.'||t,'SELECT') OR has_table_privilege('authenticated','public.'||t,'INSERT')
 THEN RAISE EXCEPTION 'unsafe table %',t; END IF;
 END LOOP;
END $$;
