CREATE TABLE public.lead_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text UNIQUE NOT NULL,
  email_original text NOT NULL,
  first_name text NOT NULL,
  consent_granted boolean NOT NULL,
  consent_copy text NOT NULL,
  consent_version text NOT NULL,
  consent_at timestamptz NOT NULL,
  assessment_json jsonb NOT NULL,
  plan_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.lead_plans TO service_role;

ALTER TABLE public.lead_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages lead plans"
  ON public.lead_plans FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
