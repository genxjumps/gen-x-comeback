-- One account-level control for optional program reminders. It is intentionally
-- channel-neutral so later comeback delivery must respect the same choice
-- without activating any delivery behavior here.
CREATE TABLE public.customer_program_reminder_preferences (
  customer_id uuid PRIMARY KEY REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  program_reminders_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_program_reminder_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_program_reminder_preferences
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_program_reminder_preferences TO service_role;

CREATE POLICY "Service role reads customer program reminder preferences"
  ON public.customer_program_reminder_preferences
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Service role creates customer program reminder preferences"
  ON public.customer_program_reminder_preferences
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role updates customer program reminder preferences"
  ON public.customer_program_reminder_preferences
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE DELETE ON TABLE public.customer_program_reminder_preferences FROM service_role;
