-- Manual refund requests; no provider calls, role assignments, or live activation.
CREATE TABLE public.accelerator_refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL UNIQUE REFERENCES public.paid_purchases(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','refunded')),
  refunded_at timestamptz,
  CHECK ((status='requested' AND refunded_at IS NULL) OR (status='refunded' AND refunded_at IS NOT NULL))
);
CREATE TABLE public.accelerator_refund_receipts (
  purchase_id uuid PRIMARY KEY REFERENCES public.paid_purchases(id) ON DELETE RESTRICT,
  stripe_charge_id text NOT NULL UNIQUE CHECK (stripe_charge_id ~ '^ch_[A-Za-z0-9]+$'),
  amount_cents integer NOT NULL CHECK (amount_cents=3700),
  currency text NOT NULL CHECK (currency='USD'),
  refund_ids text[] NOT NULL CHECK (cardinality(refund_ids)>0),
  confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Separate from the progress-only admin role. No implicit permission expansion.
CREATE TABLE public.private_refund_reviewers (
  customer_id uuid PRIMARY KEY REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO service_role',t);
    EXECUTE format('CREATE POLICY service_role_only ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',t);
  END LOOP;
END $$;

CREATE FUNCTION public.request_accelerator_refund(p_customer_id uuid,p_purchase_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.paid_purchases%ROWTYPE; r public.accelerator_refund_requests%ROWTYPE; v_now timestamptz;
BEGIN
  SELECT * INTO p FROM public.paid_purchases WHERE id=p_purchase_id AND customer_id=p_customer_id
    AND product_code='accelerator_28' AND purchase_source='stripe_checkout' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','unavailable'); END IF;
  SELECT * INTO r FROM public.accelerator_refund_requests WHERE purchase_id=p.id;
  IF FOUND THEN RETURN jsonb_build_object('outcome','received','requestId',r.id); END IF;
  IF p.status='refunded' THEN RETURN jsonb_build_object('outcome','refunded'); END IF;
  v_now:=clock_timestamp();
  IF p.status<>'paid' OR v_now<p.purchased_at OR v_now>p.refund_request_deadline_at THEN
    RETURN jsonb_build_object('outcome','ineligible');
  END IF;
  INSERT INTO public.accelerator_refund_requests(purchase_id,requested_at) VALUES(p.id,v_now) RETURNING * INTO r;
  RETURN jsonb_build_object('outcome','received','requestId',r.id);
END $$;

CREATE FUNCTION public.get_accelerator_refund_purchases(p_customer_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'purchaseId',p.id,'purchasedAt',p.purchased_at,'deadline',p.refund_request_deadline_at,
   'purchaseStatus',p.status,'requestedAt',r.requested_at,'refundedAt',receipt.confirmed_at,
   'canRequest',p.status='paid' AND r.id IS NULL AND now() BETWEEN p.purchased_at AND p.refund_request_deadline_at
 ) ORDER BY p.purchased_at DESC),'[]'::jsonb)
 FROM public.paid_purchases p LEFT JOIN public.accelerator_refund_requests r ON r.purchase_id=p.id
 LEFT JOIN public.accelerator_refund_receipts receipt ON receipt.purchase_id=p.id
 WHERE p.customer_id=p_customer_id AND p.product_code='accelerator_28' AND p.purchase_source='stripe_checkout';
$$;

CREATE FUNCTION public.get_accelerator_refund_queue(p_reviewer_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.private_refund_reviewers WHERE customer_id=p_reviewer_id) THEN RETURN NULL; END IF;
 RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'requestId',r.id,'purchaseId',p.id,'customerEmail',c.email_normalized,
   'requestedAt',r.requested_at,'deadline',p.refund_request_deadline_at,'status',r.status,
   'refundedAt',r.refunded_at,'checkoutSessionId',p.source_reference
 ) ORDER BY (r.status='requested') DESC,r.requested_at),'[]'::jsonb)
 FROM public.accelerator_refund_requests r JOIN public.paid_purchases p ON p.id=r.purchase_id
 JOIN public.customer_accounts c ON c.id=p.customer_id);
END $$;

-- Called only with a freshly retrieved test-mode Stripe charge and a complete
-- list of succeeded refunds. The browser has no route to this capability.
CREATE FUNCTION public.confirm_accelerator_full_refund(
 p_source_reference text,p_charge_id text,p_amount_cents integer,p_currency text,p_refund_ids text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.paid_purchases%ROWTYPE; v_customer uuid; v_entitlement uuid;
BEGIN
 IF p_source_reference IS NULL OR p_source_reference !~ '^cs_test_[A-Za-z0-9]+$'
 OR p_charge_id IS NULL OR p_charge_id !~ '^ch_[A-Za-z0-9]+$'
 OR p_amount_cents IS DISTINCT FROM 3700 OR p_currency IS DISTINCT FROM 'USD'
 OR p_refund_ids IS NULL OR cardinality(p_refund_ids)=0
 OR EXISTS(SELECT 1 FROM unnest(p_refund_ids) x WHERE x IS NULL OR x !~ '^re_[A-Za-z0-9]+$')
 OR cardinality(p_refund_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_refund_ids) x)
 THEN RETURN jsonb_build_object('outcome','invalid'); END IF;
 SELECT customer_id INTO v_customer FROM public.paid_purchases
 WHERE purchase_source='stripe_checkout' AND source_reference=p_source_reference;
 IF NOT FOUND THEN RETURN jsonb_build_object('outcome','purchase_pending'); END IF;
 -- Same customer lock as start/switch/provision, before row locks.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_customer::text,2));
 SELECT * INTO p FROM public.paid_purchases WHERE purchase_source='stripe_checkout'
 AND source_reference=p_source_reference FOR UPDATE;
 IF p.product_code<>'accelerator_28' OR p.amount_cents<>p_amount_cents OR p.currency<>p_currency
 THEN RETURN jsonb_build_object('outcome','invalid'); END IF;
 IF EXISTS(SELECT 1 FROM public.accelerator_refund_receipts WHERE purchase_id=p.id) THEN
   IF NOT EXISTS(SELECT 1 FROM public.accelerator_refund_receipts WHERE purchase_id=p.id AND stripe_charge_id=p_charge_id) THEN
     RETURN jsonb_build_object('outcome','invalid');
   END IF;
   RETURN jsonb_build_object('outcome','replayed');
 END IF;
 INSERT INTO public.accelerator_refund_receipts(purchase_id,stripe_charge_id,amount_cents,currency,refund_ids)
 VALUES(p.id,p_charge_id,p_amount_cents,p_currency,p_refund_ids);
 UPDATE public.paid_purchases SET status='refunded',updated_at=now() WHERE id=p.id;
 UPDATE public.accelerator_refund_requests SET status='refunded',refunded_at=clock_timestamp() WHERE purchase_id=p.id;
 -- An old purchase's late webhook must never revoke a newer purchase.
 SELECT id INTO v_entitlement FROM public.paid_product_entitlements WHERE purchase_id=p.id FOR UPDATE;
 IF FOUND THEN
   UPDATE public.paid_product_entitlements SET status='revoked',revoked_at=now(),updated_at=now() WHERE id=v_entitlement;
   UPDATE public.paid_program_enrollments SET status='revoked',revoked_at=now(),updated_at=now()
     WHERE entitlement_id=v_entitlement AND status IN ('active','paused');
   DELETE FROM public.customer_active_programs a USING public.paid_program_enrollments n
     WHERE a.paid_enrollment_id=n.id AND n.entitlement_id=v_entitlement;
   UPDATE public.paid_access_tokens SET revoked_at=now() WHERE entitlement_id=v_entitlement AND revoked_at IS NULL;
 END IF;
 RETURN jsonb_build_object('outcome','refunded');
END $$;

REVOKE ALL ON FUNCTION public.request_accelerator_refund(uuid,uuid),public.get_accelerator_refund_purchases(uuid),
 public.get_accelerator_refund_queue(uuid),public.confirm_accelerator_full_refund(text,text,integer,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_accelerator_refund(uuid,uuid),public.get_accelerator_refund_purchases(uuid),
 public.get_accelerator_refund_queue(uuid),public.confirm_accelerator_full_refund(text,text,integer,text,text[]) TO service_role;

-- Forward replacement: preserve provisioning/outbox, serialize ownership changes,
-- and prevent refunded/obsolete Checkout replays from restoring access or email.
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
    OR p_purchased_at IS NULL OR p_product_code <> 'accelerator_28'
    OR p_amount_cents <> 3700 OR p_currency <> 'USD'
    OR NOT EXISTS (SELECT 1 FROM public.customer_accounts account WHERE account.id = p_customer_id)
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 2));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_purchase_source || chr(31) || p_source_reference, 1)
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
    IF v_purchase.status <> 'paid' THEN
      RETURN QUERY SELECT 'refunded_or_inactive'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
      RETURN;
    END IF;
    SELECT entitlement.id INTO v_entitlement_id
      FROM public.paid_product_entitlements entitlement
     WHERE entitlement.customer_id = p_customer_id
       AND entitlement.product_code = p_product_code
       AND entitlement.purchase_id = v_purchase.id AND entitlement.status = 'active';
    IF v_entitlement_id IS NULL THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid, NULL::uuid, NULL::uuid, false;
      RETURN;
    END IF;
    PERFORM public.enqueue_paid_access_job(
      'paid_purchase_access', p_customer_id, v_entitlement_id,
      'paid_purchase_access:' || v_purchase.id::text || ':v1', now()
    );
    RETURN QUERY SELECT 'replayed'::text, p_customer_id, v_purchase.id, v_entitlement_id, true;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.paid_purchases purchase
    WHERE purchase.purchase_source = p_purchase_source
      AND purchase.source_reference = p_source_reference)
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
  ON CONFLICT ON CONSTRAINT paid_product_entitlements_customer_product_unique DO UPDATE
    SET purchase_id = EXCLUDED.purchase_id, status = 'active',
        granted_at = EXCLUDED.granted_at, revoked_at = NULL, updated_at = now()
  RETURNING id INTO v_entitlement_id;

  PERFORM public.enqueue_paid_access_job(
    'paid_purchase_access', p_customer_id, v_entitlement_id,
    'paid_purchase_access:' || v_purchase.id::text || ':v1', now()
  );

  RETURN QUERY SELECT 'created'::text, p_customer_id, v_purchase.id, v_entitlement_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_accelerator_ownership(
  uuid, text, text, text, text, timestamptz, text, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_accelerator_ownership(
  uuid, text, text, text, text, timestamptz, text, integer, text
) TO service_role;
