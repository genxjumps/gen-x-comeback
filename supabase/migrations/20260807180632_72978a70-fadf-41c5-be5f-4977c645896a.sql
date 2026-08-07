-- Corrective checkpoint, part 1 of 2.
--
-- Contract gap: starting a genuinely NEW Gen X Jumps 7-Day Plan must activate
-- BOTH Plan-email consent and general marketing consent under the one
-- normalized identity. The existing BEFORE INSERT trigger proves this only for
-- a brand-new lead_plans row. When an existing normalized identity commits a
-- new Plan version through the authoritative atomic plan-commit boundary
-- (public.commit_plan_version), the same activation must happen inside that
-- same transaction, on the same single row.
--
-- Forward-only and minimal: no already-applied migration is rewritten and the
-- large authoritative commit function is not rewritten. The activation is bound
-- to the exact plan-commit write that publishes a new plan version, detected by
-- plan_version_id actually changing. Every other UPDATE on lead_plans (access
-- token refresh, unchanged reload, consent transitions, suppression writes,
-- delivery engagement writes) leaves consent state untouched, so consent is
-- never reactivated by an arbitrary row update.
--
-- Hard-bounce / complaint suppression is explicitly preserved: this boundary
-- never clears email_suppressed_at or email_suppression_reason, and the
-- authoritative dispatch suppression fence continues to block sending.
CREATE OR REPLACE FUNCTION public.apply_new_plan_version_consent_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only a genuinely new committed Plan version is a new Plan start.
  IF NEW.plan_version_id IS DISTINCT FROM OLD.plan_version_id THEN
    NEW.plan_email_consent_active := true;
    NEW.plan_email_consent_source := 'plan_signup';
    NEW.plan_email_consent_at := now();
    NEW.plan_email_unsubscribed_at := NULL;

    NEW.marketing_consent_active := true;
    NEW.marketing_consent_source := 'plan_signup';
    NEW.marketing_consent_at := now();
    NEW.marketing_unsubscribed_at := NULL;

    -- Suppression is absolute and is never relaxed by a new Plan start.
    NEW.email_suppressed_at := OLD.email_suppressed_at;
    NEW.email_suppression_reason := OLD.email_suppression_reason;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS apply_new_plan_version_consent_state_before_update ON public.lead_plans;
CREATE TRIGGER apply_new_plan_version_consent_state_before_update
  BEFORE UPDATE ON public.lead_plans
  FOR EACH ROW EXECUTE FUNCTION public.apply_new_plan_version_consent_state();