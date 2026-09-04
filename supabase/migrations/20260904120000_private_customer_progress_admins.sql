-- Private, account-bound allow-list for Todd's read-only customer-progress view.
-- It deliberately grants no customer-facing access and contains no role that
-- can change purchases, programs, email, refunds, or customer accounts.
CREATE TABLE public.private_customer_progress_admins (
  customer_id uuid PRIMARY KEY REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.private_customer_progress_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.private_customer_progress_admins
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.private_customer_progress_admins TO service_role;

CREATE POLICY "Service role reads private customer progress admins"
  ON public.private_customer_progress_admins
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Service role creates private customer progress admins"
  ON public.private_customer_progress_admins
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role updates private customer progress admins"
  ON public.private_customer_progress_admins
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE DELETE ON TABLE public.private_customer_progress_admins FROM service_role;
