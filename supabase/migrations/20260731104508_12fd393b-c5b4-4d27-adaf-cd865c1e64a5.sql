ALTER TABLE public.lead_plans ADD COLUMN access_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS lead_plans_access_token_hash_key
  ON public.lead_plans (access_token_hash)
  WHERE access_token_hash IS NOT NULL;