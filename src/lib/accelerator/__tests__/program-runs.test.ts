import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activateLeadPlan,
  isIanaTimeZone,
  pauseProgramRun,
  resumeProgramRun,
  startAcceleratorRun,
} from "../program-runs.server";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc },
}));

const customerAccountId = "00000000-0000-4000-8000-000000000001";
const entitlementId = "00000000-0000-4000-8000-000000000002";
const enrollmentId = "00000000-0000-4000-8000-000000000003";

describe("program-run lifecycle", () => {
  beforeEach(() => rpc.mockReset());

  it("starts a versioned run separately from purchase ownership", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          outcome: "started",
          enrollment_id: enrollmentId,
          run_number: 2,
          paused_enrollment_id: "00000000-0000-4000-8000-000000000004",
          paused_lead_plan_id: null,
        },
      ],
      error: null,
    });

    const result = await startAcceleratorRun({
      customerAccountId,
      entitlementId,
      customerTimeZone: "America/New_York",
    });
    expect(result.runNumber).toBe(2);
    expect(rpc).toHaveBeenCalledWith(
      "start_program_run_atomic",
      expect.objectContaining({
        p_customer_id: customerAccountId,
        p_entitlement_id: entitlementId,
        p_program_version: "accelerator_28_v1",
        p_customer_time_zone: "America/New_York",
      }),
    );
    expect(rpc.mock.calls[0][1].p_program_snapshot.days).toHaveLength(28);
  });

  it("pauses only the requested active run for the verified account", async () => {
    rpc.mockResolvedValue({ data: [{ id: enrollmentId, status: "paused" }], error: null });
    await expect(pauseProgramRun({ customerAccountId, enrollmentId })).resolves.toEqual({
      enrollmentId,
      status: "paused",
    });
  });

  it("resumes a run and reports the run paused by the switch", async () => {
    const displaced = "00000000-0000-4000-8000-000000000004";
    rpc.mockResolvedValue({
      data: [
        {
          outcome: "resumed",
          enrollment_id: enrollmentId,
          paused_enrollment_id: displaced,
          paused_lead_plan_id: null,
        },
      ],
      error: null,
    });
    await expect(resumeProgramRun({ customerAccountId, enrollmentId })).resolves.toEqual({
      enrollmentId,
      pausedEnrollmentId: displaced,
      pausedLeadPlanId: null,
    });
  });

  it("switches to a linked unfinished 7-Day Plan without resetting either program", async () => {
    const leadPlanId = "00000000-0000-4000-8000-000000000005";
    rpc.mockResolvedValue({
      data: [
        { outcome: "activated", lead_plan_id: leadPlanId, paused_enrollment_id: enrollmentId },
      ],
      error: null,
    });
    await expect(activateLeadPlan({ customerAccountId, leadPlanId })).resolves.toEqual({
      leadPlanId,
      pausedEnrollmentId: enrollmentId,
    });
  });

  it("accepts real IANA zones and rejects invented zones before an RPC", async () => {
    expect(isIanaTimeZone("America/New_York")).toBe(true);
    expect(isIanaTimeZone("Todd/Backyard")).toBe(false);
    await expect(
      startAcceleratorRun({ customerAccountId, entitlementId, customerTimeZone: "Todd/Backyard" }),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed when a lifecycle transaction returns no accepted row", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(
      startAcceleratorRun({ customerAccountId, entitlementId, customerTimeZone: "UTC" }),
    ).rejects.toThrow();
    await expect(pauseProgramRun({ customerAccountId, enrollmentId })).rejects.toThrow();
    await expect(resumeProgramRun({ customerAccountId, enrollmentId })).rejects.toThrow();
  });
});
