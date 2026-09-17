// Server-only calendar configuration for a saved 7-Day Comeback Plan.

export function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export async function configureLeadPlanCalendar(
  leadPlanId: string,
  timeZone: string,
): Promise<void> {
  if (!isIanaTimeZone(timeZone)) throw new Error("Invalid plan time zone");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("configure_lead_plan_calendar", {
    p_lead_plan_id: leadPlanId,
    p_time_zone: timeZone,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Plan calendar configuration was rejected");
}

export async function leadPlanDayAvailable(
  leadPlanId: string,
  planVersionId: string,
  dayNumber: number,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("lead_plan_day_is_available", {
    p_lead_plan_id: leadPlanId,
    p_plan_version_id: planVersionId,
    p_day_number: dayNumber,
  });
  if (error) throw new Error(error.message);
  return data === true;
}
