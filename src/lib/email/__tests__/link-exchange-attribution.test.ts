// Focused attribution tests for the deliberate /return link-exchange event.
// Pure: no database, no network, no provider, no environment reads.
import { describe, expect, it } from "vitest";

import {
  HALFWAY_LINK_EXCHANGE_EVENT,
  PLAN_READY_LINK_EXCHANGE_EVENT,
  START_DAY_1_LINK_EXCHANGE_EVENT,
  resolveLinkExchangeAttribution,
} from "@/lib/email/link-exchange-event";
import {
  HALFWAY_JOB_TYPE,
  HALFWAY_JOB_VERSION,
  HALFWAY_TEMPLATE_VERSION,
  PLAN_READY_JOB_TYPE,
  START_DAY_1_JOB_TYPE,
  START_DAY_1_JOB_VERSION,
  START_DAY_1_TEMPLATE_VERSION,
} from "@/lib/email/types";

const LEAD = "lead-1";
const VERSION = "version-1";

function trusted(
  job: Record<string, unknown> | null,
  purpose: string | null = "open_plan",
): Parameters<typeof resolveLinkExchangeAttribution>[0] {
  return {
    purpose,
    leadPlanId: LEAD,
    planVersionId: VERSION,
    job: job as never,
  };
}

const startDayOneJob = {
  jobId: "sd1-job",
  jobType: START_DAY_1_JOB_TYPE,
  jobVersion: START_DAY_1_JOB_VERSION,
  templateVersion: START_DAY_1_TEMPLATE_VERSION,
  leadPlanId: LEAD,
  planVersionId: VERSION,
};

const halfwayJob = {
  jobId: "halfway-job",
  jobType: HALFWAY_JOB_TYPE,
  jobVersion: HALFWAY_JOB_VERSION,
  templateVersion: HALFWAY_TEMPLATE_VERSION,
  leadPlanId: LEAD,
  planVersionId: VERSION,
};

const planReadyJob = {
  jobId: "plan-ready-job",
  jobType: PLAN_READY_JOB_TYPE,
  jobVersion: "v1",
  templateVersion: "plan_ready_v1",
  leadPlanId: LEAD,
  planVersionId: VERSION,
};

describe("deliberate link-exchange attribution", () => {
  it("attributes the three valid lifecycle paths to distinct canonical events", () => {
    const start = resolveLinkExchangeAttribution(trusted(startDayOneJob));
    const halfway = resolveLinkExchangeAttribution(trusted(halfwayJob));
    const planReady = resolveLinkExchangeAttribution(trusted(planReadyJob));

    expect(start).toEqual({ eventName: START_DAY_1_LINK_EXCHANGE_EVENT, jobId: "sd1-job" });
    expect(halfway).toEqual({ eventName: HALFWAY_LINK_EXCHANGE_EVENT, jobId: "halfway-job" });
    // Plan Ready keeps its general exchange event name and now correlates to
    // the originating Plan Ready job id.
    expect(planReady).toEqual({
      eventName: PLAN_READY_LINK_EXCHANGE_EVENT,
      jobId: "plan-ready-job",
    });

    expect(new Set([start.eventName, halfway.eventName, planReady.eventName]).size).toBe(3);
  });

  it("never reattributes a recovery token, even for a canonical lifecycle job", () => {
    for (const job of [startDayOneJob, halfwayJob]) {
      expect(resolveLinkExchangeAttribution(trusted(job, "recovery"))).toEqual({
        eventName: PLAN_READY_LINK_EXCHANGE_EVENT,
        jobId: null,
      });
    }
  });

  it("never reattributes a jobless token or a token with no job id", () => {
    expect(resolveLinkExchangeAttribution(trusted(null))).toEqual({
      eventName: PLAN_READY_LINK_EXCHANGE_EVENT,
      jobId: null,
    });
    expect(resolveLinkExchangeAttribution(trusted({ ...startDayOneJob, jobId: null }))).toEqual({
      eventName: PLAN_READY_LINK_EXCHANGE_EVENT,
      jobId: null,
    });
  });

  it("never reattributes a non-canonical job or template version", () => {
    for (const job of [
      { ...startDayOneJob, jobVersion: "v2" },
      { ...startDayOneJob, templateVersion: "start_day_1_v2" },
      { ...halfwayJob, jobVersion: "v2" },
      { ...halfwayJob, templateVersion: "halfway_v2" },
    ]) {
      expect(resolveLinkExchangeAttribution(trusted(job)).eventName).toBe(
        PLAN_READY_LINK_EXCHANGE_EVENT,
      );
    }
  });

  it("never reattributes a job that does not own the validated lead and plan version", () => {
    for (const job of [
      { ...startDayOneJob, leadPlanId: "lead-2" },
      { ...startDayOneJob, planVersionId: "version-2" },
      { ...halfwayJob, leadPlanId: "lead-2" },
      { ...halfwayJob, planVersionId: "version-2" },
    ]) {
      expect(resolveLinkExchangeAttribution(trusted(job))).toEqual({
        eventName: PLAN_READY_LINK_EXCHANGE_EVENT,
        jobId: null,
      });
    }
  });

  it("carries only the internal job id, never any private state", () => {
    const attribution = resolveLinkExchangeAttribution(trusted(startDayOneJob));
    expect(Object.keys(attribution).sort()).toEqual(["eventName", "jobId"]);
  });
});
