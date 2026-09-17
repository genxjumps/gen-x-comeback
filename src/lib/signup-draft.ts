import { ASSESSMENT_STORAGE_KEY, emptyAnswers, type Answers } from "@/lib/plan";
const OWNER_KEY = "gxj_assessment_owner_v1";
export const ELIGIBILITY_STORAGE_KEY = "gxj_eligibility_answer_v1";

/** A draft belongs to one signup in this browser, never to a different device. */
export function bindSignupDraft(draftKey: string): void {
  try {
    if (window.localStorage.getItem(OWNER_KEY) !== draftKey) {
      window.localStorage.removeItem(ASSESSMENT_STORAGE_KEY);
      window.localStorage.removeItem(ELIGIBILITY_STORAGE_KEY);
      window.localStorage.removeItem("gxj_submission_v1");
      window.localStorage.setItem(OWNER_KEY, draftKey);
    }
  } catch {
    /* unavailable storage starts fresh */
  }
}
export function firstUnfinishedAssessmentStep(answers: Partial<Answers>): 1 | 2 | 3 {
  if (!answers.q1 || !answers.q2) return 1;
  if (!answers.q3 || !answers.q4?.length) return 2;
  return 3;
}
export function signupDraftDestination(): "/assessment/start" | "/assessment" {
  try {
    const eligible = window.localStorage.getItem(ELIGIBILITY_STORAGE_KEY);
    if (eligible === "yes" || eligible === "yes_modified") return "/assessment";
  } catch {
    /* no draft */
  }
  return "/assessment/start";
}
export function readSignupAnswers(): Answers {
  try {
    const value = JSON.parse(window.localStorage.getItem(ASSESSMENT_STORAGE_KEY) ?? "null");
    return value && typeof value === "object" ? { ...emptyAnswers, ...value } : emptyAnswers;
  } catch {
    return emptyAnswers;
  }
}
