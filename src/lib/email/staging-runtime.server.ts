// Staging-only fake-provider dispatch runtime. Server-only.
//
// This builds dispatcher dependencies that (a) always use the deterministic fake
// adapter, regardless of EMAIL_PROVIDER, and (b) can claim jobs ONLY for one
// explicitly supplied synthetic lead plan.
//
// It intentionally requires none of the production release-gate flags
// (EMAIL_SENDING_ENABLED, EMAIL_STAGING_ACCEPTANCE_PASSED,
// EMAIL_PROVIDER_API_KEY, EMAIL_WEBHOOK_SECRET,
// EMAIL_SENDING_DOMAIN_VERIFIED, EMAIL_CLICK_TRACKING_DISABLED,
// EMAIL_ALERTS_ENABLED). It still fails closed without the configuration needed
// to render and derive links.
import { createFakeAdapter } from "@/lib/email/adapters.server";
import { readEmailConfig, resolveAppOrigin } from "@/lib/email/config.server";
import { createSupabaseEmailStore } from "@/lib/email/store.server";
import {
  EMAIL_TOKEN_SECRET_ENV,
  deriveEmailCredential,
  readEmailTokenSecret,
} from "@/lib/email/credentials.server";
import type { DispatchDeps } from "@/lib/email/dispatch";
import { hashAccessToken } from "@/lib/lead-plan";

export type FakeStagingRuntime =
  | { enabled: true; deps: DispatchDeps }
  | { enabled: false; missing: string[] };

export async function buildFakeStagingDispatchDeps(
  leadPlanId: string,
): Promise<FakeStagingRuntime> {
  const config = readEmailConfig();
  const tokenSecret = readEmailTokenSecret();

  const missing: string[] = [];
  if (!config.appOrigin || !/^https:\/\//.test(config.appOrigin)) missing.push("APP_ORIGIN");
  if (!config.fromEmail) missing.push("EMAIL_FROM_ADDRESS");
  if (!config.replyTo) missing.push("EMAIL_REPLY_TO");
  if (!tokenSecret) missing.push(EMAIL_TOKEN_SECRET_ENV);
  if (missing.length > 0) return { enabled: false, missing };

  const secret = tokenSecret as string;

  return {
    enabled: true,
    deps: {
      // Lead-scoped claim: another lead's jobs can never be claimed or mutated.
      store: await createSupabaseEmailStore({ leadPlanScope: leadPlanId }),
      // Always fake. The Resend adapter is never imported or instantiated here.
      adapter: createFakeAdapter(),
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
