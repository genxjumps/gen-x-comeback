import { createServerFn } from "@tanstack/react-start";

import type { Answers } from "@/lib/plan";
import {
  CONSENT_COPY,
  CONSENT_VERSION,
  planFromAnswers,
  ropeLevelFromExperience,
  toPlanDayView,
  type DayBriefResult,
  type DayOneBriefResult,
  type PlanDayView,
  type PlanHubResult,
  type ProgressResult,
  type RegenerateResult,
  type SaveLeadPlanResult,
  type StartDayOneResult,
  type VerifyAccessResult,
} from "@/lib/lead-plan";
import {
  completeDayInputSchema,
  dayBriefInputSchema,
  leadInputSchema,
  regenerateInputSchema,
  tokenOnlyInputSchema,
} from "@/lib/lead-schemas";

/**
 * Resolves authorized access for a protected call: same-browser access token or
 * an authorized return-link session cookie from the emailed Open My Plan link.
 */
async function authorize(token: string | null | undefined) {
  const { currentCookieHeader, resolvePlanAccess } = await import("@/lib/plan-access.server");
  return resolvePlanAccess(token ?? null, await currentCookieHeader());
}

export const verifyAccessToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenOnlyInputSchema.parse(data))
  .handler(async ({ data }): Promise<VerifyAccessResult> => {
    const access = await authorize(data.token);
    return access ? { ok: true, firstName: access.firstName } : { ok: false };
  });

async function listCompletedDays(leadPlanId: string): Promise<number[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("lead_plan_day_completions")
    .select("day_number")
    .eq("lead_plan_id", leadPlanId)
    .order("day_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.day_number);
}

/** Loads the saved assessment and plan snapshot for an authorized lead. */
async function loadSaved(leadPlanId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("lead_plans")
    .select("assessment_json, plan_json")
    .eq("id", leadPlanId)
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

/** Derives the cardio guidance fields from server-stored data only. */
function cardioFrom(assessment: unknown, planJson: unknown) {
  const saved = (assessment ?? {}) as { q3?: unknown; q4?: unknown; equipment?: unknown };
  const savedFlags = ((planJson ?? {}) as { flags?: Record<string, unknown> }).flags ?? {};
  const q4 = Array.isArray(saved.q4) ? saved.q4 : [];
  const equipment = Array.isArray(saved.equipment) ? saved.equipment : [];
  return {
    impactLimited: q4.includes("limit_impact") || savedFlags['impactLimited'] === true,
    ownsRope: equipment.includes("jump_rope"),
    ropeLevel: ropeLevelFromExperience(typeof saved.q3 === "string" ? saved.q3 : ""),
  };
}

/**
 * Authoritative Day 1 brief: only the small guidance fields the page needs,
 * derived server-side from the saved assessment. Never from browser state.
 */
export const getDayOneBrief = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenOnlyInputSchema.parse(data))
  .handler(async ({ data }): Promise<DayOneBriefResult> => {
    const access = await authorize(data.token);
    if (!access) return { ok: false };
    const saved = await loadSaved(access.leadPlanId);
    if (!saved) return { ok: false };

    return {
      ok: true,
      cardio: cardioFrom(saved.assessment_json, saved.plan_json),
      completedDays: await listCompletedDays(access.leadPlanId),
    };
  });

/**
 * Server-authoritative brief for a protected day page. Guidance and the
 * assignment always come from the saved plan, never from browser state.
 */
export const getDayBrief = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => dayBriefInputSchema.parse(data))
  .handler(async ({ data }): Promise<DayBriefResult> => {
    const access = await authorize(data.token);
    if (!access) return { ok: false };
    const saved = await loadSaved(access.leadPlanId);
    if (!saved) return { ok: false };

    const snapshot = (saved.plan_json ?? {}) as {
      tier?: string;
      days?: Array<Record<string, unknown>>;
    };
    const raw = (snapshot.days ?? []).find(
      (d, i) => (typeof d.day === "number" ? d.day : i + 1) === data.day,
    );

    return {
      ok: true,
      tier: typeof snapshot.tier === "string" ? snapshot.tier : "",
      cardio: cardioFrom(saved.assessment_json, saved.plan_json),
      day: raw ? toPlanDayView(raw, data.day - 1) : null,
      completedDays: await listCompletedDays(access.leadPlanId),
    };
  });

/**
 * Deliberate Day 1 activation boundary. Passive page loads and return-link
 * exchanges never invoke this POST action.
 */
export const startDayOne = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenOnlyInputSchema.parse(data))
  .handler(async ({ data }): Promise<StartDayOneResult> => {
    const access = await authorize(data.token);
    if (!access) return { ok: false };

    const { recordDayOneStart } = await import("@/lib/day-one-start.server");
    return recordDayOneStart(access.leadPlanId, access.planVersionId);
  });

export const completePlanDay = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => completeDayInputSchema.parse(data))
  .handler(async ({ data }): Promise<ProgressResult> => {
    const access = await authorize(data.token);
    if (!access) return { ok: false };

    // Sequential progression is enforced server-side: every earlier day must
    // already be complete, so direct URL access cannot complete a day early.
    const already = await listCompletedDays(access.leadPlanId);
    for (let d = 1; d < data.day; d += 1) {
      if (!already.includes(d)) return { ok: false };
    }

    // A deliberate Day 1 completion proves activation, but passive access to
    // the workout page does not. Establish the idempotent start before saving
    // the completion so email rendering can never see "unstarted" afterward.
    if (data.day === 1 && !already.includes(1)) {
      const { recordDayOneStart } = await import("@/lib/day-one-start.server");
      const started = await recordDayOneStart(access.leadPlanId, access.planVersionId);
      if (!started.ok) return { ok: false };
    }

    // One transaction records the completion and, on the authoritative
    // transition from 3 to 4 required completions, resets the inactivity clock,
    // records the milestone, and creates exactly one Halfway outbox job. No
    // provider call happens here.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: applied, error } = await supabaseAdmin.rpc("complete_plan_day_atomic", {
      p_lead_plan_id: access.leadPlanId,
      p_plan_version_id: access.planVersionId,
      p_day_number: data.day,
    });
    if (error) throw new Error(error.message);
    // No row means the transaction refused the request: a replaced plan version,
    // a day that is not a top-level required assignment, or out-of-order progress.
    if (!Array.isArray(applied) || applied.length === 0) return { ok: false };

    return { ok: true, completedDays: await listCompletedDays(access.leadPlanId) };
  });

/**
 * Server-computed fingerprint of the full normalized lead-capture request.
 * The database binds a submission id to this value, so reusing a submission id
 * with any different request is rejected as a conflict.
 */
async function requestFingerprint(parts: Array<string | null>): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(parts.map((p) => p ?? "").join("\u0000")).digest("hex");
}

export const saveLeadPlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => leadInputSchema.parse(data))
  .handler(async ({ data }): Promise<SaveLeadPlanResult> => {
    const answers = data.assessment as Answers;
    const { plan, snapshot } = planFromAnswers(answers);
    const emailNormalized = data.email.toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // One transaction: plan version, same-browser access, canonical event, and
    // exactly one Plan Ready outbox job. No provider call happens here.
    const { data: rows, error } = await supabaseAdmin.rpc("commit_plan_version", {
      p_submission_id: data.submissionId,
      p_session_token_hash: data.sessionTokenHash,
      p_request_fingerprint: await requestFingerprint([
        "save",
        emailNormalized,
        data.firstName,
        JSON.stringify(answers),
      ]),
      p_email_normalized: emailNormalized,
      p_email_original: data.email,
      p_first_name: data.firstName,
      p_consent_copy: CONSENT_COPY,
      p_consent_version: CONSENT_VERSION,
      p_assessment: JSON.parse(JSON.stringify(answers)),
      p_plan: JSON.parse(JSON.stringify(snapshot)),
    });
    if (error) throw new Error(error.message);

    const result = rows?.[0];
    if (!result) throw new Error("Plan commit returned no result");
    // A conflicting or stale replay authorizes nothing and discloses nothing.
    if (result.outcome === "conflict" || result.outcome === "stale_replay") {
      throw new Error("Submission conflict");
    }

    return { firstName: result.first_name, plan, replayed: result.replayed };
  });

export const regeneratePlanWithToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => regenerateInputSchema.parse(data))
  .handler(async ({ data }): Promise<RegenerateResult> => {
    const access = await authorize(data.token);
    if (!access) return { ok: false };

    const answers = data.assessment as Answers;
    const { plan, snapshot } = planFromAnswers(answers);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The transaction decides replacement versus unchanged reload, resets
    // progress, cancels unsent jobs, and revokes replaced return tokens.
    const { data: rows, error } = await supabaseAdmin.rpc("commit_plan_version", {
      p_submission_id: data.submissionId,
      p_session_token_hash: data.sessionTokenHash,
      p_request_fingerprint: await requestFingerprint([
        "regenerate",
        access.leadPlanId,
        JSON.stringify(answers),
      ]),
      p_lead_plan_id: access.leadPlanId,
      p_assessment: JSON.parse(JSON.stringify(answers)),
      p_plan: JSON.parse(JSON.stringify(snapshot)),
    });
    if (error) throw new Error(error.message);

    const result = rows?.[0];
    if (!result) return { ok: false };
    if (result.outcome === "conflict" || result.outcome === "stale_replay") return { ok: false };

    return { ok: true, firstName: result.first_name, plan };
  });

export const getPlanHub = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenOnlyInputSchema.parse(data))
  .handler(async ({ data }): Promise<PlanHubResult> => {
    const access = await authorize(data.token);
    if (!access) return { ok: false };
    const saved = await loadSaved(access.leadPlanId);
    if (!saved) return { ok: false };

    const snapshot = (saved.plan_json ?? {}) as {
      tier?: string;
      protein?: { grams?: number | null; fallback?: boolean };
      flags?: Record<string, boolean>;
      days?: Array<Record<string, unknown>>;
    };

    const days: PlanDayView[] = (snapshot.days ?? []).map((d, i) => toPlanDayView(d, i));
    const flags = snapshot.flags ?? {};

    return {
      ok: true,
      data: {
        firstName: access.firstName,
        tier: typeof snapshot.tier === "string" ? snapshot.tier : "",
        protein: {
          grams: typeof snapshot.protein?.grams === "number" ? snapshot.protein.grams : null,
          fallback: snapshot.protein?.fallback !== false && snapshot.protein?.grams == null,
        },
        flags: {
          rope: flags.rope === true,
          dumbbells: flags.dumbbells === true,
          cushionedSurface: flags.cushionedSurface === true,
          impactLimited: flags.impactLimited === true,
        },
        days,
        completedDays: await listCompletedDays(access.leadPlanId),
      },
    };
  });
