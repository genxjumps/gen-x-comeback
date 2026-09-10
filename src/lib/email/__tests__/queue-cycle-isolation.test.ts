import { beforeEach, expect, it, vi } from "vitest";
import { createQueueRunner, RecoverableQueueError } from "@/lib/email/queue-isolation";
import { runDispatchCycle } from "@/lib/email/dispatch-cycle.server";
import type { DispatchDeps } from "@/lib/email/dispatch";

const fns = vi.hoisted(() => ({
  dispatchPlanReadyJobs: vi.fn(),
  dispatchRecoveryJobs: vi.fn(),
  dispatchPlanCompletedJobs: vi.fn(),
  dispatchHalfwayJobs: vi.fn(),
  dispatchStalledJobs: vi.fn(),
  dispatchStartDayOneJobs: vi.fn(),
  dispatchFinalRescueJobs: vi.fn(),
  raiseStalePlanReadyAlerts: vi.fn(),
}));
vi.mock("@/lib/email/dispatch", () => fns);
beforeEach(() => {
  for (const fn of Object.values(fns)) {
    fn.mockReset();
    fn.mockResolvedValue({ claimed: 1, outcomes: [] });
  }
  fns.raiseStalePlanReadyAlerts.mockResolvedValue(0);
});
it("Plan Ready preparation failure doesn't prevent recovery or the lifecycle cycle", async () => {
  fns.dispatchPlanReadyJobs.mockRejectedValue(new RecoverableQueueError("claim"));
  const queues = createQueueRunner(async () => {});
  const result = await runDispatchCycle({} as DispatchDeps, { runQueue: queues.run });
  expect(result.planReady.claimed).toBe(0);
  expect(result.recovery.claimed).toBe(1);
  expect(fns.dispatchStartDayOneJobs).toHaveBeenCalledOnce();
  expect(queues.failures).toEqual(["plan_ready"]);
});
it("defers lower priority lifecycle queues when a higher priority one fails", async () => {
  fns.dispatchPlanCompletedJobs.mockRejectedValue(new RecoverableQueueError("state"));
  const queues = createQueueRunner(async () => {});
  await runDispatchCycle({} as DispatchDeps, { runQueue: queues.run });
  expect(fns.dispatchRecoveryJobs).toHaveBeenCalledOnce();
  expect(fns.dispatchHalfwayJobs).not.toHaveBeenCalled();
  expect(fns.dispatchStartDayOneJobs).not.toHaveBeenCalled();
});
it("propagates unknown failures to the existing global shutdown boundary", async () => {
  fns.dispatchPlanReadyJobs.mockRejectedValue(Error("provider evidence failed"));
  const queues = createQueueRunner(async () => {});
  await expect(runDispatchCycle({} as DispatchDeps, { runQueue: queues.run })).rejects.toThrow(
    "provider evidence failed",
  );
  expect(fns.dispatchRecoveryJobs).not.toHaveBeenCalled();
});
