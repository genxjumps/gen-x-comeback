-- PostgreSQL text values cannot contain chr(0). The original ownership
-- transaction used that character while deriving its advisory-lock key, so
-- every otherwise-valid purchase failed before either ownership insert.
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
  ON CONFLICT ON CONSTRAINT paid_product_entitlements_customer_product_unique DO UPDATE
    SET purchase_id = EXCLUDED.purchase_id, status = 'active',
        granted_at = EXCLUDED.granted_at, revoked_at = NULL, updated_at = now()
  RETURNING id INTO v_entitlement_id;

  RETURN QUERY SELECT 'created'::text, p_customer_id, v_purchase.id, v_entitlement_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_accelerator_ownership(
  uuid, text, text, text, text, timestamptz, text, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_accelerator_ownership(
  uuid, text, text, text, text, timestamptz, text, integer, text
) TO service_role;
