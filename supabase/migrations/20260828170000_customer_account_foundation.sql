-- Unified Gen X Jumps customer identity foundation.
--
-- This migration intentionally sorts before the still-unapplied Accelerator
-- enrollment migration. It does not apply or activate either migration.

CREATE TABLE public.customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  email_normalized text NOT NULL UNIQUE CHECK (
    email_normalized = lower(btrim(email_normalized))
    AND length(email_normalized) BETWEEN 3 AND 254
  ),
  email_original text NOT NULL CHECK (
    length(btrim(email_original)) BETWEEN 3 AND 254
  ),
  email_verified_at timestamptz NOT NULL,
  first_name text CHECK (
    first_name IS NULL OR length(btrim(first_name)) BETWEEN 1 AND 60
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customer_lead_plan_links (
  customer_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  lead_plan_id uuid NOT NULL UNIQUE REFERENCES public.lead_plans(id) ON DELETE RESTRICT,
  link_source text NOT NULL CHECK (link_source = 'verified_email'),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, lead_plan_id)
);

CREATE INDEX customer_lead_plan_links_customer_id_idx
  ON public.customer_lead_plan_links (customer_id, linked_at);

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_lead_plan_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customer_lead_plan_links FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_lead_plan_links TO service_role;

CREATE POLICY "Service role manages customer accounts"
  ON public.customer_accounts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages customer lead plan links"
  ON public.customer_lead_plan_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- The caller must first verify the Supabase Auth bearer token and obtain the
-- confirmed auth user ID and email. The function is service-role only so an
-- untrusted browser cannot claim an email address or enumerate an account.
CREATE OR REPLACE FUNCTION public.resolve_verified_customer_account(
  p_auth_user_id uuid,
  p_email_normalized text,
  p_email_original text,
  p_email_verified_at timestamptz,
  p_first_name text
) RETURNS TABLE(
  outcome text,
  customer_id uuid,
  customer_first_name text,
  linked_lead_plans integer,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customer_accounts%ROWTYPE;
  v_first_name text;
  v_linked integer := 0;
  v_created boolean := false;
BEGIN
  IF p_auth_user_id IS NULL
    OR p_email_normalized IS NULL
    OR p_email_normalized <> lower(btrim(p_email_normalized))
    OR length(p_email_normalized) NOT BETWEEN 3 AND 254
    OR p_email_original IS NULL
    OR lower(btrim(p_email_original)) <> p_email_normalized
    OR p_email_verified_at IS NULL
    OR (p_first_name IS NOT NULL AND length(btrim(p_first_name)) NOT BETWEEN 1 AND 60)
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::text, 0, false;
    RETURN;
  END IF;

  v_first_name := NULLIF(btrim(p_first_name), '');

  -- Serialize both identity keys so exact retries cannot create competing rows.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_email_normalized, 1));

  SELECT * INTO v_customer
    FROM public.customer_accounts
   WHERE auth_user_id = p_auth_user_id
   FOR UPDATE;

  IF FOUND THEN
    IF EXISTS (
      SELECT 1
        FROM public.customer_accounts
       WHERE email_normalized = p_email_normalized
         AND id <> v_customer.id
    ) THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid, NULL::text, 0, false;
      RETURN;
    END IF;

    UPDATE public.customer_accounts
       SET email_normalized = p_email_normalized,
           email_original = btrim(p_email_original),
           email_verified_at = GREATEST(email_verified_at, p_email_verified_at),
           first_name = COALESCE(v_first_name, first_name),
           updated_at = now()
     WHERE id = v_customer.id
     RETURNING * INTO v_customer;
  ELSE
    IF EXISTS (
      SELECT 1
        FROM public.customer_accounts
       WHERE email_normalized = p_email_normalized
    ) THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid, NULL::text, 0, false;
      RETURN;
    END IF;

    IF v_first_name IS NULL THEN
      SELECT NULLIF(btrim(first_name), '') INTO v_first_name
        FROM public.lead_plans
       WHERE email_normalized = p_email_normalized
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1;
    END IF;

    INSERT INTO public.customer_accounts (
      auth_user_id,
      email_normalized,
      email_original,
      email_verified_at,
      first_name
    ) VALUES (
      p_auth_user_id,
      p_email_normalized,
      btrim(p_email_original),
      p_email_verified_at,
      v_first_name
    )
    RETURNING * INTO v_customer;
    v_created := true;
  END IF;

  -- A confirmed auth mailbox proves control of matching legacy free-plan
  -- records. Linking preserves every free-plan and consent record unchanged.
  INSERT INTO public.customer_lead_plan_links (
    customer_id,
    lead_plan_id,
    link_source
  )
  SELECT v_customer.id, lead.id, 'verified_email'
    FROM public.lead_plans lead
   WHERE lead.email_normalized = p_email_normalized
  ON CONFLICT (lead_plan_id) DO NOTHING;

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  RETURN QUERY SELECT
    CASE WHEN v_created THEN 'created'::text ELSE 'replayed'::text END,
    v_customer.id,
    v_customer.first_name,
    v_linked,
    NOT v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_verified_customer_account(
  uuid, text, text, timestamptz, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_verified_customer_account(
  uuid, text, text, timestamptz, text
) TO service_role;
