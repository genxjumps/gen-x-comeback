-- One current, versioned nutrition profile per customer account. Nutrition is
-- independent of program runs and never changes workout progress.
CREATE TABLE public.customer_nutrition_profiles (
  customer_id uuid PRIMARY KEY REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  formula_version text NOT NULL CHECK (length(btrim(formula_version)) BETWEEN 1 AND 100),
  input_payload jsonb NOT NULL CHECK (jsonb_typeof(input_payload) = 'object'),
  maintenance_calories integer NOT NULL CHECK (maintenance_calories >= 1200),
  target_payload jsonb NOT NULL CHECK (jsonb_typeof(target_payload) = 'object'),
  meal_slider_positions jsonb NOT NULL CHECK (jsonb_typeof(meal_slider_positions) = 'object'),
  calculated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_nutrition_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_nutrition_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_nutrition_profiles TO service_role;

CREATE POLICY "Service role reads customer nutrition profiles"
  ON public.customer_nutrition_profiles
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Service role creates customer nutrition profiles"
  ON public.customer_nutrition_profiles
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role updates customer nutrition profiles"
  ON public.customer_nutrition_profiles
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE DELETE ON TABLE public.customer_nutrition_profiles FROM service_role;
