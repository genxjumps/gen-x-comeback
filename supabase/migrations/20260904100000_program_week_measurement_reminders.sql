-- Persistent dismissal state for the optional in-app weekly measurement reminder.
-- This creates no email, push-notification, public enrollment, or payment behavior.

CREATE UNIQUE INDEX paid_program_enrollments_id_customer_idx
  ON public.paid_program_enrollments (id, customer_id);

CREATE TABLE public.customer_program_reminder_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  enrollment_id uuid NOT NULL,
  reminder_code text NOT NULL CHECK (reminder_code = 'weekly_measurement'),
  program_week smallint NOT NULL CHECK (program_week BETWEEN 2 AND 4),
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_program_reminder_dismissals_run_owner_fkey
    FOREIGN KEY (enrollment_id, customer_id)
    REFERENCES public.paid_program_enrollments (id, customer_id)
    ON DELETE CASCADE,
  CONSTRAINT customer_program_reminder_dismissals_once_per_week
    UNIQUE (enrollment_id, reminder_code, program_week)
);

CREATE INDEX customer_program_reminder_dismissals_customer_idx
  ON public.customer_program_reminder_dismissals (customer_id, created_at DESC);

ALTER TABLE public.customer_program_reminder_dismissals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_program_reminder_dismissals
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.customer_program_reminder_dismissals TO service_role;

CREATE POLICY "Service role reads program reminder dismissals"
  ON public.customer_program_reminder_dismissals
  FOR SELECT TO service_role USING (true);

CREATE POLICY "Service role creates program reminder dismissals"
  ON public.customer_program_reminder_dismissals
  FOR INSERT TO service_role WITH CHECK (true);

REVOKE UPDATE, DELETE ON TABLE public.customer_program_reminder_dismissals FROM service_role;
