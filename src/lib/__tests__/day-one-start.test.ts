import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc },
}));

import { recordDayOneStart } from "@/lib/day-one-start.server";

const LEAD_PLAN_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const STARTED_AT = "2026-08-04T12:00:00.000Z";

describe("authoritative Day 1 start persistence", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("sends only the authorized server-derived plan identifiers to the RPC", async () => {
    rpc.mockResolvedValue({
      data: [{ started_at: STARTED_AT, newly_started: true }],
      error: null,
    });

    await expect(recordDayOneStart(LEAD_PLAN_ID, PLAN_VERSION_ID)).resolves.toEqual({
      ok: true,
      startedAt: STARTED_AT,
      newlyStarted: true,
    });
    expect(rpc).toHaveBeenCalledWith("mark_day_1_started", {
      p_lead_plan_id: LEAD_PLAN_ID,
      p_plan_version_id: PLAN_VERSION_ID,
    });
  });

  it("returns the original start on an idempotent repeat", async () => {
    rpc.mockResolvedValue({
      data: [{ started_at: STARTED_AT, newly_started: false }],
      error: null,
    });

    await expect(recordDayOneStart(LEAD_PLAN_ID, PLAN_VERSION_ID)).resolves.toEqual({
      ok: true,
      startedAt: STARTED_AT,
      newlyStarted: false,
    });
  });

  it("fails closed when the database rejects a stale, replaced, or completed plan", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(recordDayOneStart(LEAD_PLAN_ID, PLAN_VERSION_ID)).resolves.toEqual({
      ok: false,
    });
  });

  it("does not convert a database failure into false activation success", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });

    await expect(recordDayOneStart(LEAD_PLAN_ID, PLAN_VERSION_ID)).rejects.toThrow(
      "database unavailable",
    );
  });
});
