CREATE TABLE public.lead_plan_day_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_plan_id uuid NOT NULL REFERENCES public.lead_plans(id) ON DELETE CASCADE,
  day_number smallint NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_plan_day_completions_unique UNIQUE (lead_plan_id, day_number)
);

GRANT ALL ON public.lead_plan_day_completions TO service_role;

ALTER TABLE public.lead_plan_day_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages day completions"
ON public.lead_plan_day_completions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX lead_plan_day_completions_lead_plan_id_idx
  ON public.lead_plan_day_completions (lead_plan_id);