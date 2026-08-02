import { createServerFn } from "@tanstack/react-start";

import type { Answers } from "@/lib/plan";
import {
  CONSENT_COPY,
  CONSENT_VERSION,
  completeDayInputSchema,
  dayBriefInputSchema,
  generateAccessToken,
  hashAccessToken,
  leadInputSchema,
  planFromAnswers,
  regenerateInputSchema,
  ropeLevelFromExperience,
  toPlanDayView,
  tokenOnlyInputSchema,
  type DayBriefResult,
  type DayOneBriefResult,
  type PlanDayView,
  type PlanHubResult,
  type ProgressResult,
  type RegenerateResult,
  type SaveLeadPlanResult,
  type VerifyAccessResult,
} from "@/lib/lead-plan";

export const verifyAccessToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenOnlyInputSchema.parse(data))
  .handler(async ({ data }): Promise<VerifyAccessResult> => {
    const accessTokenHash = await hashAccessToken(data.token);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("lead_plans")
      .select("first_name")
      .eq("access_token_hash", accessTokenHash)
      .limit(1);

    if (error) throw new Error(error.message);
    const lead = rows?.[0];
    return lead ? { ok: true, firstName: lead.first_name } : { ok: false };
  });

/** Resolves the lead id for a raw access token, or null. Server-only. */
async function resolveLeadIdByToken(rawToken: string): Promise<string | null> {
  const accessTokenHash = await hashAccessToken(rawToken);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("lead_plans")
    .select("id")
    .eq("access_token_hash", accessTokenHash)
    .limit(1);
  if (error) throw new Error(error.message);
  return rows?.[0]?.id ?? null;
}

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

export const getPlanProgress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenOnlyInputSchema.parse(data))
  .handler(async ({ data }): Promise<ProgressResult> => {
    const leadPlanId = await resolveLeadIdByToken(data.token);
    if (!leadPlanId) return { ok: false };
    return { ok: true, completedDays: await listCompletedDays(leadPlanId) };
  });

/**
 * Authoritative Day 1 brief: only the small guidance fields the page needs,
 * derived server-side from the saved assessment. Never from browser state.
 */
export const getDayOneBrief = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenOnlyInputSchema.parse(data))
  .handler(async ({ data }): Promise<DayOneBriefResult> => {
    const accessTokenHash = await hashAccessToken(data.token);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("lead_plans")
      .select("id, assessment_json, plan_json")
      .eq("access_token_hash", accessTokenHash)
      .limit(1);

    if (error) throw new Error(error.message);
    const lead = rows?.[0];
    if (!lead) return { ok: false };

    const saved = (lead.assessment_json ?? {}) as {
      q3?: unknown;
      q4?: unknown;
      equipment?: unknown;
    };
    const savedFlags = ((lead.plan_json ?? {}) as { flags?: Record<string, unknown> }).flags ?? {};

    const q4 = Array.isArray(saved.q4) ? saved.q4 : [];
    const equipment = Array.isArray(saved.equipment) ? saved.equipment : [];

    return {
      ok: true,
      cardio: {
        impactLimited: q4.includes("limit_impact") || savedFlags['impactLimited'] === true,
        ownsRope: equipment.includes("jump_rope"),
        ropeLevel: ropeLevelFromExperience(typeof saved.q3 === "string" ? saved.q3 : ""),
      },
      completedDays: await listCompletedDays(lead.id),
    };
  });

/**
 * Server-authoritative brief for a protected day page. Guidance and the
 * assignment always come from the saved plan, never from browser state.
 */
export const getDayBrief = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => dayBriefInputSchema.parse(data))
  .handler(async ({ data }): Promise<DayBriefResult> => {
    const accessTokenHash = await hashAccessToken(data.token);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("lead_plans")
      .select("id, assessment_json, plan_json")
      .eq("access_token_hash", accessTokenHash)
      .limit(1);

    if (error) throw new Error(error.message);
    const lead = rows?.[0];
    if (!lead) return { ok: false };

    const saved = (lead.assessment_json ?? {}) as {
      q3?: unknown;
      q4?: unknown;
      equipment?: unknown;
    };
    const snapshot = (lead.plan_json ?? {}) as {
      tier?: string;
      flags?: Record<string, unknown>;
      days?: Array<Record<string, unknown>>;
    };
    const savedFlags = snapshot.flags ?? {};
    const q4 = Array.isArray(saved.q4) ? saved.q4 : [];
    const equipment = Array.isArray(saved.equipment) ? saved.equipment : [];

    const raw = (snapshot.days ?? []).find(
      (d, i) => (typeof d.day === "number" ? d.day : i + 1) === data.day,
    );

    return {
      ok: true,
      tier: typeof snapshot.tier === "string" ? snapshot.tier : "",
      cardio: {
        impactLimited: q4.includes("limit_impact") || savedFlags['impactLimited'] === true,
        ownsRope: equipment.includes("jump_rope"),
        ropeLevel: ropeLevelFromExperience(typeof saved.q3 === "string" ? saved.q3 : ""),
      },
      day: raw ? toPlanDayView(raw, data.day - 1) : null,
      completedDays: await listCompletedDays(lead.id),
    };
  });

export const completePlanDay = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => completeDayInputSchema.parse(data))
  .handler(async ({ data }): Promise<ProgressResult> => {
    const leadPlanId = await resolveLeadIdByToken(data.token);
    if (!leadPlanId) return { ok: false };

    // Sequential progression is enforced server-side: every earlier day must
    // already be complete, so direct URL access cannot complete a day early.
    const already = await listCompletedDays(leadPlanId);
    for (let d = 1; d < data.day; d += 1) {
      if (!already.includes(d)) return { ok: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("lead_plan_day_completions")
      .upsert(
        { lead_plan_id: leadPlanId, day_number: data.day },
        { onConflict: "lead_plan_id,day_number", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);

    return { ok: true, completedDays: await listCompletedDays(leadPlanId) };
  });


/** A successful reassessment replaces the current plan, so progress resets. */
async function resetProgress(leadPlanId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("lead_plan_day_completions")
    .delete()
    .eq("lead_plan_id", leadPlanId);
  if (error) throw new Error(error.message);
}

/** Order-insensitive canonical JSON so stored answers compare reliably. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export const saveLeadPlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => leadInputSchema.parse(data))
  .handler(async ({ data }): Promise<SaveLeadPlanResult> => {
    const answers = data.assessment as Answers;
    const { plan, snapshot } = planFromAnswers(answers);

    const emailNormalized = data.email.toLowerCase();
    const now = new Date().toISOString();
    const accessToken = generateAccessToken();
    const accessTokenHash = await hashAccessToken(accessToken);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error: upsertError } = await supabaseAdmin
      .from("lead_plans")
      .upsert(
        {
          email_normalized: emailNormalized,
          email_original: data.email,
          first_name: data.firstName,
          consent_granted: true,
          consent_copy: CONSENT_COPY,
          consent_version: CONSENT_VERSION,
          consent_at: now,
          assessment_json: JSON.parse(JSON.stringify(answers)),
          plan_json: JSON.parse(JSON.stringify(snapshot)),
          access_token_hash: accessTokenHash,
          updated_at: now,
        },
        { onConflict: "email_normalized" },
      )
      .select("id");

    if (upsertError) throw new Error(upsertError.message);

    // This opt-in replaces whatever current plan existed for this email, so progress resets.
    const leadPlanId = rows?.[0]?.id;
    if (leadPlanId) await resetProgress(leadPlanId);

    return { firstName: data.firstName, plan, accessToken };
  });

export const regeneratePlanWithToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => regenerateInputSchema.parse(data))
  .handler(async ({ data }): Promise<RegenerateResult> => {
    const accessTokenHash = await hashAccessToken(data.token);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("lead_plans")
      .select("id, first_name, assessment_json")
      .eq("access_token_hash", accessTokenHash)
      .limit(1);

    if (error) throw new Error(error.message);
    const lead = rows?.[0];
    if (!lead) return { ok: false };

    const answers = data.assessment as Answers;
    const { plan, snapshot } = planFromAnswers(answers);
    const changed = canonical(lead.assessment_json) !== canonical(answers);

    const { error: updateError } = await supabaseAdmin
      .from("lead_plans")
      .update({
        assessment_json: JSON.parse(JSON.stringify(answers)),
        plan_json: JSON.parse(JSON.stringify(snapshot)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (updateError) throw new Error(updateError.message);

    // Only a real reassessment replaces the plan; an identical reload keeps progress.
    if (changed) await resetProgress(lead.id);

    return { ok: true, firstName: lead.first_name, plan };
  });


export const getPlanHub = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenOnlyInputSchema.parse(data))
  .handler(async ({ data }): Promise<PlanHubResult> => {
    const accessTokenHash = await hashAccessToken(data.token);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("lead_plans")
      .select("id, first_name, plan_json")
      .eq("access_token_hash", accessTokenHash)
      .limit(1);

    if (error) throw new Error(error.message);
    const lead = rows?.[0];
    if (!lead) return { ok: false };

    const snapshot = (lead.plan_json ?? {}) as {
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
        firstName: lead.first_name,
        tier: typeof snapshot.tier === "string" ? snapshot.tier : "",
        protein: {
          grams:
            typeof snapshot.protein?.grams === "number" ? snapshot.protein.grams : null,
          fallback: snapshot.protein?.fallback !== false && snapshot.protein?.grams == null,
        },
        flags: {
          rope: flags.rope === true,
          dumbbells: flags.dumbbells === true,
          cushionedSurface: flags.cushionedSurface === true,
          impactLimited: flags.impactLimited === true,
        },
        days,
        completedDays: await listCompletedDays(lead.id),
      },
    };
  });
