import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  START_DAY_1_ELIGIBILITY_DELAY_MS,
  START_DAY_1_JOB_TYPE,
  START_DAY_1_JOB_VERSION,
  START_DAY_1_TEMPLATE_VERSION,
} from "../types";

const migrationPath = fileURLToPath(
  new URL(
    "../../../../supabase/migrations/20260804000000_start_day_1_job_foundation.sql",
    import.meta.url,
  ),
);
const migration = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ");

describe("Start Day 1 durable job creation", () => {
  it("defines the locked V1 job identity and 24-hour eligibility delay", () => {
    expect(START_DAY_1_JOB_TYPE).toBe("start_day_1");
    expect(START_DAY_1_JOB_VERSION).toBe("v1");
    expect(START_DAY_1_TEMPLATE_VERSION).toBe("start_day_1_v1");
    expect(START_DAY_1_ELIGIBILITY_DELAY_MS).toBe(86_400_000);
    expect(migration).toContain("'start_day_1:' || NEW.plan_version_id::text || ':v1'");
    expect(migration).toContain("NEW.created_at + interval '24 hours'");
  });

  it("creates the job from the Plan Ready insert in the same plan-commit transaction", () => {
    expect(migration).toContain(
      "IF NEW.job_type <> 'plan_ready' OR NEW.job_version <> 'v1' THEN RETURN NEW; END IF;",
    );
    expect(migration).toContain("AFTER INSERT ON public.email_jobs");
    expect(migration).toContain("EXECUTE FUNCTION public.enqueue_start_day_1_for_plan_ready()");
  });

  it("uses the logical job key to prevent duplicate jobs and queued events", () => {
    expect(migration).toContain(
      "ON CONFLICT (job_type, plan_version_id, job_version) DO NOTHING RETURNING job_id INTO v_job_id",
    );
    expect(migration).toContain("IF v_job_id IS NOT NULL THEN");
    expect(migration).toContain("'email_start_day_1_queued'");
  });

  it("backfills only current plan versions and preserves the 24-hour floor", () => {
    expect(migration).toContain("AND lead.plan_version_id = plan_ready.plan_version_id");
    expect(migration).toContain("plan_ready.created_at + interval '24 hours'");
    expect(migration).toContain("ON CONFLICT (job_type, plan_version_id, job_version) DO NOTHING");
  });

  it("inherits reassessment cancellation for every unsent replaced-plan job", () => {
    const correctionMigration = readFileSync(
      fileURLToPath(
        new URL(
          "../../../../supabase/migrations/20260803012559_e668ac33-992e-48c2-900c-2c3a6b8eb0b6.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(correctionMigration).toContain(
      "WHERE plan_version_id = v_lead.plan_version_id AND status IN ('pending','processing','retry_scheduled')",
    );
  });
});
