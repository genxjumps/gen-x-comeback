import { describe, expect, it, vi } from "vitest";
import {
  createQueueRunner,
  isolatePreparation,
  RecoverableQueueError,
} from "@/lib/email/queue-isolation";
import { emailHealthIsReady } from "@/lib/email/health";

describe("queue isolation", () => {
  it("continues independent queues after preparation failure and records the affected queue", async () => {
    const report = vi.fn(async () => {});
    const queues = createQueueRunner(report);
    const store = isolatePreparation(
      {
        claim: async () => {
          throw Error("database unavailable");
        },
      },
      ["claim"],
    );
    expect(await queues.run("signup_welcome", () => store.claim(), null)).toBeNull();
    const recovery = vi.fn(async () => "sent");
    expect(await queues.run("recovery", recovery, "")).toBe("sent");
    expect(queues.failures).toEqual(["signup_welcome"]);
    expect(report).toHaveBeenCalledWith("signup_welcome", "claim");
    expect(recovery).toHaveBeenCalledOnce();
  });
  it("never converts provider reservation or evidence failures into preparation failures", async () => {
    const queues = createQueueRunner(async () => {});
    const store = isolatePreparation(
      {
        claim: async () => 1,
        reserve: async () => {
          throw Error("reservation uncertain");
        },
        evidence: async () => {
          throw Error("evidence unavailable");
        },
      },
      ["claim"],
    );
    for (const work of [store.reserve, store.evidence]) {
      await expect(queues.run("purchase", work, null)).rejects.toThrow();
    }
    expect(queues.failures).toEqual([]);
  });
  it("continues when incident persistence fails but marks monitoring as failed", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const queues = createQueueRunner(async () => {
        throw Error("DB down");
      });
      await queues.run(
        "welcome",
        async () => {
          throw new RecoverableQueueError("claim");
        },
        null,
      );
      expect(await queues.run("recovery", async () => "sent", "")).toBe("sent");
      expect(queues.failures).toContain("monitoring");
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
describe("independently monitorable email health", () => {
  const now = Date.parse("2026-09-10T17:00:00Z");
  const good = {
    sending: true,
    paidSending: true,
    unresolvedIncidents: false,
    lastCron: {
      invoked_at: "2026-09-10T16:55:00Z",
      completed_at: "2026-09-10T16:55:05Z",
      dispatch_succeeded: true,
    },
  };
  it("requires recent successful cron evidence and both sending gates", () => {
    expect(emailHealthIsReady(good, now)).toBe(true);
    for (const patch of [
      { sending: false },
      { paidSending: false },
      { unresolvedIncidents: true },
      { lastCron: null },
    ]) {
      expect(emailHealthIsReady({ ...good, ...patch }, now)).toBe(false);
    }
    expect(emailHealthIsReady(good, now + 13 * 60_000)).toBe(false);
    expect(
      emailHealthIsReady(
        { ...good, lastCron: { ...good.lastCron, dispatch_succeeded: false } },
        now,
      ),
    ).toBe(false);
  });
});
