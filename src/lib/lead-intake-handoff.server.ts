import { generateAccessToken, hashAccessToken } from "@/lib/lead-plan";
import {
  LEAD_INTAKE_COOKIE,
  LEAD_INTAKE_TTL_SECONDS,
  websiteLeadIntakeSchema,
} from "@/lib/lead-intake-handoff";
import { readCookie } from "@/lib/plan-access.server";
import type { z } from "zod";

type WebsiteLeadIntake = z.infer<typeof websiteLeadIntakeSchema>;
type StoreError = { message: string } | null;

export type LeadIntakeIdentity = {
  intakeId: string;
  firstName: string;
  emailOriginal: string;
  emailNormalized: string;
  consentCopy: string;
  consentVersion: string;
  consentAt: string;
};

type IntakeRow = {
  intake_id: string;
  first_name: string;
  email_original: string;
  email_normalized: string;
  consent_copy: string;
  consent_version: string;
  consent_at: string;
  expires_at: string;
  completed_at: string | null;
};

type IntakeSelectResult = { data: IntakeRow[] | null; error: StoreError };
type IntakeInsertResult = { error: StoreError };
type IntakeQuery = {
  select(columns: string): IntakeQuery;
  eq(column: string, value: string): IntakeQuery;
  gt(column: string, value: string): IntakeQuery;
  is(column: string, value: null): IntakeQuery;
  limit(count: number): PromiseLike<IntakeSelectResult>;
  insert(values: Record<string, unknown>): PromiseLike<IntakeInsertResult>;
};
type IntakeStore = { from(table: "lead_intakes"): IntakeQuery };
type RpcResult = { data: unknown; error: StoreError };
type IntakeRpc = (name: string, args: Record<string, unknown>) => Promise<RpcResult>;

export function controlledTestLeadIntakeAllowed(email: string): boolean {
  const configured = process.env["NEW_PLAN_INTAKE_TEST_EMAILS"];
  if (!configured) return false;

  const normalized = email.trim().toLowerCase();
  return configured
    .split(",")
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

function identity(row: IntakeRow): LeadIntakeIdentity {
  return {
    intakeId: row.intake_id,
    firstName: row.first_name,
    emailOriginal: row.email_original,
    emailNormalized: row.email_normalized,
    consentCopy: row.consent_copy,
    consentVersion: row.consent_version,
    consentAt: row.consent_at,
  };
}

export async function createWebsiteLeadIntake(
  input: WebsiteLeadIntake,
  consent: { copy: string; version: string },
  now = new Date(),
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateAccessToken();
  const expiresAt = new Date(now.getTime() + LEAD_INTAKE_TTL_SECONDS * 1000);
  const attribution = {
    ...(input.utmSource ? { utm_source: input.utmSource } : {}),
    ...(input.utmMedium ? { utm_medium: input.utmMedium } : {}),
    ...(input.utmCampaign ? { utm_campaign: input.utmCampaign } : {}),
    ...(input.utmContent ? { utm_content: input.utmContent } : {}),
  };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const store = supabaseAdmin as unknown as IntakeStore;
  const { error } = await store.from("lead_intakes").insert({
    token_hash: await hashAccessToken(rawToken),
    email_normalized: input.email.toLowerCase(),
    email_original: input.email,
    first_name: input.firstName,
    consent_copy: consent.copy,
    consent_version: consent.version,
    consent_at: now.toISOString(),
    source: input.source,
    landing_path: input.landingPath,
    referrer_origin: input.referrerOrigin,
    attribution,
    marketing_consent_active: true,
    marketing_consent_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(error.message);
  return { rawToken, expiresAt };
}

export async function resolveLeadIntake(
  cookieHeader: string | null,
): Promise<LeadIntakeIdentity | null> {
  const rawToken = readCookie(cookieHeader, LEAD_INTAKE_COOKIE);
  if (!rawToken) return null;
  let tokenHash: string;
  try {
    tokenHash = await hashAccessToken(rawToken);
  } catch {
    return null;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const store = supabaseAdmin as unknown as IntakeStore;
  const { data, error } = await store
    .from("lead_intakes")
    .select(
      "intake_id, first_name, email_original, email_normalized, consent_copy, consent_version, consent_at, expires_at, completed_at",
    )
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .is("completed_at", null)
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ? identity(data[0]) : null;
}

export async function claimLeadIntake(
  cookieHeader: string | null,
  submissionId: string,
): Promise<LeadIntakeIdentity | null> {
  const rawToken = readCookie(cookieHeader, LEAD_INTAKE_COOKIE);
  if (!rawToken) return null;
  const tokenHash = await hashAccessToken(rawToken);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as IntakeRpc;
  const { data, error } = await rpc("claim_lead_intake_for_plan", {
    p_token_hash: tokenHash,
    p_submission_id: submissionId,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? (data[0] as IntakeRow | undefined) : undefined;
  return row ? identity(row) : null;
}

export async function completeLeadIntake(
  intakeId: string,
  submissionId: string,
  leadPlanId: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as IntakeRpc;
  const { data, error } = await rpc("complete_lead_intake", {
    p_intake_id: intakeId,
    p_submission_id: submissionId,
    p_lead_plan_id: leadPlanId,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Lead intake completion was rejected");
}
