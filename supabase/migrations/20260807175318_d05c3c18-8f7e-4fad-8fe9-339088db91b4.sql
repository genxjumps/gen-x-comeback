REVOKE ALL ON FUNCTION public.cancel_unsent_proactive_jobs(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_plan_email_consent(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_unsent_proactive_jobs(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_plan_email_consent(uuid, boolean, text) TO service_role;