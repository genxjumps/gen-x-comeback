// Real-provider staging dispatch runtime. Server-only.
//
// This is the smallest safe lead-scoped real-provider mode:
//   - always the existing Resend adapter, fixed by server config
//   - job claiming ONLY through the lead-scoped claim RPC
//   - a provider request is possible only after the authoritative current email
//     for the scoped lead exactly equals EMAIL_REAL_STAGING_ALLOWED_RECIPIENT
//
// It requires the real provider/sender, token/link, and webhook signing
// configuration, but deliberately NOT the production release gate flags
// EMAIL_SENDING_ENABLED or EMAIL_STAGING_ACCEPTANCE_PASSED. Those production
// gates are untouched.
import { createResendAdapter } from "@/lib/email/adapters.server";
import { readEmailConfig, resolveAppOrigin } from "@/lib/email/config.server";
import {
  EMAIL_REAL_STAGING_ALLOWED_RECIPIENT_ENV,
  EMAIL_REAL_STAGING_ENABLED_ENV,
  readRealStagingConfig,
  recipientIsAllowed,
} from "@/lib/email/real-staging-config.server";
import { createSupabaseEmailStore } from "@/lib/email/store.server";
import {
  EMAIL_TOKEN_SECRET_ENV,
  deriveEmailCredential,
  readEmailTokenSecret,
} from "@/lib/email/credentials.server";
import type { DispatchDeps } from "@/lib/email/dispatch";
import { hashAccessToken } from "@/lib/lead-plan";
import type { EmailAdapter, EmailSendRequest, EmailSendResult } from "@/lib/email/types";

export type ProviderEvidence = {
  providerKey: string;
  providerMessageId: string;
};

export type RealStagingRuntime =
  | { ok: true; deps: DispatchDeps; evidence: () => ProviderEvidence | null }
  | { ok: false; error: "missing_configuration"; missing: string[] }
  | { ok: false; error: "recipient_not_allowed" };

/**
 * Records only non-secret provider evidence (provider key and provider message
 * id) for accepted sends. Never captures recipients, headers, or bodies.
 */
function withEvidence(adapter: EmailAdapter): {
  adapter: EmailAdapter;
  evidence: () => ProviderEvidence | null;
} {
  let latest: ProviderEvidence | null = null;
  const wrapped: EmailAdapter = {
    ...adapter,
    key: adapter.key,
    async send(request: EmailSendRequest): Promise<EmailSendResult> {
      const result = await adapter.send(request);
      if (result.outcome === "accepted") {
        latest = { providerKey: result.providerKey, providerMessageId: result.providerMessageId };
      }
      return result;
    },
  };
  return { adapter: wrapped, evidence: () => latest };
}

export async function buildRealStagingDispatchDeps(
  leadPlanId: string,
): Promise<RealStagingRuntime> {
  const staging = readRealStagingConfig();
  const config = readEmailConfig();
  const tokenSecret = readEmailTokenSecret();

  const missing: string[] = [];
  // Server-side enablement and allowlist: request input can never supply these.
  if (!staging.enabled) missing.push(EMAIL_REAL_STAGING_ENABLED_ENV);
  if (!staging.allowedRecipient) missing.push(EMAIL_REAL_STAGING_ALLOWED_RECIPIENT_ENV);
  // Real provider and sender identity.
  if (!config.providerApiKey) missing.push("EMAIL_PROVIDER_API_KEY");
  if (!config.fromEmail) missing.push("EMAIL_FROM_ADDRESS");
  if (!config.replyTo) missing.push("EMAIL_REPLY_TO");
  // Token/link rendering and derivation.
  if (!config.appOrigin || !/^https:\/\//.test(config.appOrigin)) missing.push("APP_ORIGIN");
  if (!tokenSecret) missing.push(EMAIL_TOKEN_SECRET_ENV);
  // Webhook signing, so real provider delivery events can be verified.
  if (!config.webhookSecret) missing.push("EMAIL_WEBHOOK_SECRET");
  if (missing.length > 0) return { ok: false, error: "missing_configuration", missing };

  const secret = tokenSecret as string;

  // Lead-scoped store only. The broad claim_email_jobs path is never reachable.
  const store = await createSupabaseEmailStore({ leadPlanScope: leadPlanId });

  // Authoritative recipient check against current database state, before any
  // job is claimed and before any provider request exists.
  const lead = await store.getLead(leadPlanId);
  const authoritativeEmail = lead?.email_normalized ?? lead?.email_original ?? null;
  if (!recipientIsAllowed(authoritativeEmail, staging.allowedRecipient)) {
    return { ok: false, error: "recipient_not_allowed" };
  }

  // Provider is fixed to Resend by server config; the request cannot override it.
  const { adapter, evidence } = withEvidence(createResendAdapter(config.providerApiKey as string));

  return {
    ok: true,
    evidence,
    deps: {
      store,
      adapter,
      now: () => new Date(),
      appOrigin: resolveAppOrigin(config),
      fromEmail: config.fromEmail as string,
      fromName: config.fromName,
      replyTo: config.replyTo as string,
      deriveCredential: (purpose, planVersionId, scope) =>
        deriveEmailCredential(secret, purpose, planVersionId, scope),
      hash: hashAccessToken,
    },
  };
}
