import { generateAccessToken, hashAccessToken } from "@/lib/lead-plan";
import {
  LEAD_INTAKE_COOKIE,
  LEAD_INTAKE_TTL_SECONDS,
  WEBSITE_INTAKE_ORIGIN,
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

function normalizedOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isConfiguredGmailAlias(configuredEmail: string, candidateEmail: string): boolean {
  const configuredAt = configuredEmail.lastIndexOf("@");
  const candidateAt = candidateEmail.lastIndexOf("@");
  if (configuredAt <= 0 || candidateAt <= 0) return false;

  const configuredLocal = configuredEmail.slice(0, configuredAt);
  const configuredDomain = configuredEmail.slice(configuredAt + 1);
  const candidateLocal = candidateEmail.slice(0, candidateAt);
  const candidateDomain = candidateEmail.slice(candidateAt + 1);

  if (configuredDomain !== "gmail.com" || candidateDomain !== configuredDomain) return false;
  if (configuredLocal.includes("+")) return false;

  const aliasPrefix = `${configuredLocal}+`;
  if (!candidateLocal.startsWith(aliasPrefix)) return false;
  return /^[a-z0-9][a-z0-9._-]{0,62}$/.test(candidateLocal.slice(aliasPrefix.length));
}

export function controlledTestLeadIntakeAllowed(email: string, request: Request): boolean {
  const configured = process.env["NEW_PLAN_INTAKE_TEST_EMAILS"];
  if (!configured) return false;

  const normalized = email.trim().toLowerCase();
  const configuredEmails = configured
    .split(",")
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean);
  if (configuredEmails.includes(normalized)) return true;

  // Gmail plus aliases are a controlled-preview test convenience only. Exact
  // configured identities remain valid from any already-trusted intake origin,
  // but an alias must come from the separately configured external preview.
  const requestOrigin = normalizedOrigin(request.headers.get("origin"));
  const requestUrlOrigin = normalizedOrigin(request.url);
  const previewOrigin = normalizedOrigin(process.env["WEBSITE_ORIGIN"] ?? null);
  if (
    !requestOrigin ||
    !requestUrlOrigin ||
    !previewOrigin ||
    previewOrigin === WEBSITE_INTAKE_ORIGIN ||
    previewOrigin === requestUrlOrigin ||
    requestOrigin !== previewOrigin
  ) {
    return false;
  }

  return configuredEmails.some((candidate) => isConfiguredGmailAlias(candidate, normalized));
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
  controlledTest = false,
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
    controlled_test: controlledTest,
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
  // Best-effort wake after the intake + welcome job transaction commits.
  // The authenticated five-minute scheduler retries if wake-up is unavailable.
  try {
    await supabaseAdmin.rpc("invoke_email_dispatch_scheduler");
  } catch {
    /* durable outbox */
  }
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

/**
 * During closed-intake testing, move the production email fence to the newly
 * completed controlled plan. This never enables sending or admits genuine
 * plans; it only removes the manual per-alias control update.
 */
export async function admitControlledPlanEmailScope(leadPlanId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("email_production_control")
    .update({ controlled_lead_plan_id: leadPlanId, updated_at: new Date().toISOString() })
    .eq("singleton_id", 1)
    .eq("genuine_plans_admitted", false)
    .select("controlled_lead_plan_id")
    .limit(1);
  if (error) throw new Error(error.message);
  if (data?.[0]?.controlled_lead_plan_id !== leadPlanId) {
    throw new Error("Controlled email scope was not updated");
  }
}
