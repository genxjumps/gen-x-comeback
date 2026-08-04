// Server-only access to the authoritative Day 1 start boundary.

export type DayOneStartRecord = {
  ok: true;
  startedAt: string;
  newlyStarted: boolean;
};

export type DayOneStartResult = DayOneStartRecord | { ok: false };

/**
 * Records Day 1 activation once for the exact current plan version.
 *
 * The database rejects stale/replaced versions and completed Day 1 state. Only
 * the service-role server client can execute the underlying RPC.
 */
export async function recordDayOneStart(
  leadPlanId: string,
  planVersionId: string,
): Promise<DayOneStartResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  type RpcResult = {
    data: Array<{ started_at: string; newly_started: boolean }> | null;
    error: { message: string } | null;
  };
  const markDayOneStarted = supabaseAdmin.rpc as unknown as (
    name: "mark_day_1_started",
    args: { p_lead_plan_id: string; p_plan_version_id: string },
  ) => Promise<RpcResult>;

  const { data, error } = await markDayOneStarted("mark_day_1_started", {
    p_lead_plan_id: leadPlanId,
    p_plan_version_id: planVersionId,
  });
  if (error) throw new Error(error.message);

  const row = data?.[0];
  return row
    ? {
        ok: true,
        startedAt: row.started_at,
        newlyStarted: row.newly_started,
      }
    : { ok: false };
}
