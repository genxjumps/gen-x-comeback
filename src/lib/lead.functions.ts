import { createServerFn } from "@tanstack/react-start";

import type { Answers } from "@/lib/plan";
import {
  CONSENT_COPY,
  CONSENT_VERSION,
  generateAccessToken,
  hashAccessToken,
  leadInputSchema,
  planFromAnswers,
  regenerateInputSchema,
  tokenOnlyInputSchema,
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
    const { error } = await supabaseAdmin.from("lead_plans").upsert(
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
    );

    if (error) throw new Error(error.message);

    return { firstName: data.firstName, plan, accessToken };
  });

export const regeneratePlanWithToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => regenerateInputSchema.parse(data))
  .handler(async ({ data }): Promise<RegenerateResult> => {
    const accessTokenHash = await hashAccessToken(data.token);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("lead_plans")
      .select("id, first_name")
      .eq("access_token_hash", accessTokenHash)
      .limit(1);

    if (error) throw new Error(error.message);
    const lead = rows?.[0];
    if (!lead) return { ok: false };

    const answers = data.assessment as Answers;
    const { plan, snapshot } = planFromAnswers(answers);

    const { error: updateError } = await supabaseAdmin
      .from("lead_plans")
      .update({
        assessment_json: JSON.parse(JSON.stringify(answers)),
        plan_json: JSON.parse(JSON.stringify(snapshot)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (updateError) throw new Error(updateError.message);

    return { ok: true, firstName: lead.first_name, plan };
  });
