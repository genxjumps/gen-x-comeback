// Wires deployment configuration, the Supabase store, and the chosen provider
// adapter into dispatcher dependencies. Server-only, fail-closed.
import { createFakeAdapter, createResendAdapter } from "@/lib/email/adapters.server";
import { evaluateSendingGate, readEmailConfig, resolveAppOrigin } from "@/lib/email/config.server";
import { createSupabaseEmailStore } from "@/lib/email/store.server";
import {
  EMAIL_TOKEN_SECRET_ENV,
  deriveEmailCredential,
  readEmailTokenSecret,
} from "@/lib/email/credentials.server";
import type { DispatchDeps } from "@/lib/email/dispatch";
import { hashAccessToken } from "@/lib/lead-plan";
import type { EmailAdapter } from "@/lib/email/types";

export type RuntimeDeps =
  | { enabled: true; deps: DispatchDeps }
  | { enabled: false; missing: string[] };

export async function buildDispatchDeps(invocationId?: string): Promise<RuntimeDeps> {
  const config = readEmailConfig();
  const gate = evaluateSendingGate(config);
  const tokenSecret = readEmailTokenSecret();

  // Without the derivation key, retries could not reproduce the same links.
  if (!gate.enabled || !tokenSecret) {
    const missing = gate.enabled ? [] : gate.missing;
    return {
      enabled: false,
      missing: tokenSecret ? missing : [...missing, EMAIL_TOKEN_SECRET_ENV],
    };
  }

  const adapter: EmailAdapter =
    config.providerKey === "fake"
      ? createFakeAdapter()
      : createResendAdapter(config.providerApiKey as string);

  return {
    enabled: true,
    deps: {
      store: await createSupabaseEmailStore(
        invocationId ? { productionInvocationId: invocationId } : undefined,
      ),
      adapter,
      now: () => new Date(),
      appOrigin: resolveAppOrigin(config),
      fromEmail: config.fromEmail as string,
      fromName: config.fromName,
      replyTo: config.replyTo as string,
      deriveCredential: (purpose, planVersionId, scope) =>
        deriveEmailCredential(tokenSecret, purpose, planVersionId, scope),
      hash: hashAccessToken,
    },
  };
}
