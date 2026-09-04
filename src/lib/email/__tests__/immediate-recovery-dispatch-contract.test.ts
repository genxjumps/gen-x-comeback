import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("immediate Recovery dispatch contract", () => {
  it("wakes the existing production scheduler only after the recovery RPC succeeds", () => {
    const recover = readSource("../../../routes/recover.ts");

    const recoveryCall = 'client.rpc("request_plan_recovery"';
    const successBranch = "} else {";
    const wakeCall = 'client.rpc("invoke_email_dispatch_scheduler")';

    expect(recover).toContain(recoveryCall);
    expect(recover).toContain(wakeCall);
    expect(recover.indexOf(wakeCall)).toBeGreaterThan(recover.indexOf(recoveryCall));
    expect(recover.indexOf(wakeCall)).toBeGreaterThan(
      recover.indexOf(successBranch, recover.indexOf(recoveryCall)),
    );
  });

  it("keeps Recovery on the normal scheduler fences and cron fallback", () => {
    const recover = readSource("../../../routes/recover.ts");
    const scheduler = readSource("../production-scheduler.server.ts");

    expect(recover).toContain("the queued job remains durable for the cron");
    expect(recover).not.toContain("createResendAdapter");
    expect(recover).not.toContain("dispatchRecoveryJobs");
    expect(scheduler).toContain("readProductionDispatchGate");
    expect(scheduler).toContain("finishSchedulerInvocation");
    expect(scheduler).toContain("disableProductionSending");
  });

  it("pins production email links to the customer-facing app domain", () => {
    const runtime = readSource("../runtime.server.ts");

    expect(runtime).toContain(
      'PRODUCTION_APP_ORIGIN = "https://app.genxjumps.com"',
    );
    expect(runtime).toContain("appOrigin: PRODUCTION_APP_ORIGIN");
    expect(runtime).not.toContain("appOrigin: resolveAppOrigin(config)");
  });

  it("keeps wake failures non-identifying and non-fatal to the public response", () => {
    const recover = readSource("../../../routes/recover.ts");

    expect(recover).toContain("recovery_dispatch_wake_error code=");
    expect(recover).toContain("recovery_dispatch_wake_exception");
    expect(recover).toContain("sanitizeErrorCode(wakeError.code)");
    expect(recover).toContain("return genericAcknowledgement()");
  });
});
