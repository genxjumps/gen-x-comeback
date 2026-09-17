-- Browser-bound handoff for a verified guest Accelerator purchase.
--
-- Stripe's signed webhook is the only writer. The browser cannot read this
-- table directly; the trusted checkout service returns the one-time auth token
-- only after the same browser proves the random pre-checkout claim.

CREATE TABLE public.accelerator_guest_checkout_handoffs (
  stripe_session_id text PRIMARY KEY CHECK (stripe_session_id ~ '^cs_test_[A-Za-z0-9]+$'),
  customer_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  entitlement_id uuid NOT NULL REFERENCES public.paid_product_entitlements(id) ON DELETE RESTRICT,
  auth_token_hash text NOT NULL CHECK (length(auth_token_hash) BETWEEN 20 AND 512),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at)
);

CREATE INDEX accelerator_guest_checkout_handoffs_customer_idx
  ON public.accelerator_guest_checkout_handoffs (customer_id, created_at DESC);

ALTER TABLE public.accelerator_guest_checkout_handoffs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.accelerator_guest_checkout_handoffs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.accelerator_guest_checkout_handoffs TO service_role;

CREATE POLICY "Service role manages guest checkout handoffs"
  ON public.accelerator_guest_checkout_handoffs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
