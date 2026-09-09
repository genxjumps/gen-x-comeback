import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindSignupDraft,
  firstUnfinishedAssessmentStep,
  signupDraftDestination,
} from "@/lib/signup-draft";
import { ASSESSMENT_STORAGE_KEY, emptyAnswers } from "@/lib/plan";
import { renderSignupWelcome, welcomeRetryDecision } from "@/lib/email/signup-welcome";

function browser() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  vi.stubGlobal("window", { localStorage });
  return localStorage;
}
afterEach(() => vi.unstubAllGlobals());
describe("signup assessment continuity", () => {
  it("preserves answers only for the same signup in the same browser", () => {
    const storage = browser();
    bindSignupDraft("participant-a");
    storage.setItem(
      ASSESSMENT_STORAGE_KEY,
      JSON.stringify({ ...emptyAnswers, q1: "none", q2: "restart" }),
    );
    storage.setItem("gxj_eligibility_answer_v1", "yes");
    bindSignupDraft("participant-a");
    expect(storage.getItem(ASSESSMENT_STORAGE_KEY)).not.toBeNull();
    expect(signupDraftDestination()).toBe("/assessment");
    bindSignupDraft("participant-b");
    expect(storage.getItem(ASSESSMENT_STORAGE_KEY)).toBeNull();
    expect(signupDraftDestination()).toBe("/assessment/start");
  });
  it("a different browser starts fresh even with the same participant key", () => {
    let storage = browser();
    bindSignupDraft("participant-a");
    storage.setItem("gxj_eligibility_answer_v1", "yes");
    storage = browser();
    bindSignupDraft("participant-a");
    expect(storage.getItem(ASSESSMENT_STORAGE_KEY)).toBeNull();
    expect(signupDraftDestination()).toBe("/assessment/start");
    expect(firstUnfinishedAssessmentStep(emptyAnswers)).toBe(1);
  });
  it("finds the first unfinished stage instead of trusting a saved step number", () => {
    expect(firstUnfinishedAssessmentStep({ ...emptyAnswers, q1: "0" })).toBe(1);
    expect(firstUnfinishedAssessmentStep({ ...emptyAnswers, q1: "0", q2: "restart" })).toBe(2);
    expect(
      firstUnfinishedAssessmentStep({
        ...emptyAnswers,
        q1: "0",
        q2: "restart",
        q3: "never",
        q4: ["limit_impact"],
      }),
    ).toBe(3);
  });
});
describe("welcome email retry safety", () => {
  it("keeps the provider payload identical and does not claim a plan is ready", () => {
    const link = "https://app.genxjumps.com/signup/return?token=opaque";
    const a = renderSignupWelcome(link);
    expect(renderSignupWelcome(link)).toEqual(a);
    expect(a.subject).toBe("Your Gen X Jumps access is saved");
    expect(a.text).toContain("finish setting up");
    expect(a.text).toContain("switching devices");
    expect(a.html).toContain(link);
    expect(a.text).not.toContain("Plan Ready");
  });
  it("stops before the provider deduplication horizon and after six attempts", () => {
    const now = new Date("2026-09-09T23:00:00Z");
    expect(welcomeRetryDecision(1, null, now)).toBe("send");
    expect(welcomeRetryDecision(6, "2026-09-09T22:00:00Z", now)).toBe("send");
    expect(welcomeRetryDecision(7, null, now)).toBe("stop");
    expect(welcomeRetryDecision(2, "2026-09-09T00:00:00Z", now)).toBe("stop");
  });
});
