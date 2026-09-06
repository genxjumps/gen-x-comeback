import { createFakeAdapter, createResendAdapter } from "@/lib/email/adapters.server";
import { evaluateSendingGate, readEmailConfig, resolveAppOrigin } from "@/lib/email/config.server";
import { EMAIL_TOKEN_SECRET_ENV, readEmailTokenSecret } from "@/lib/email/credentials.server";
import type { PaidAccessDispatchDeps } from "@/lib/email/paid-access-dispatch.server";
import { createPaidAccessStore } from "@/lib/email/paid-access-store.server";
import { hashAccessToken } from "@/lib/lead-plan";
import type { EmailAdapter } from "@/lib/email/types";

export type PaidAccessRuntime =
  | { enabled: true; deps: PaidAccessDispatchDeps }
  | { enabled: false; missing: string[] };

export async function buildPaidAccessDispatchDeps(
  invocationId: string,
): Promise<PaidAccessRuntime> {
  const config = readEmailConfig();
  const gate = evaluateSendingGate(config);
  const tokenSecret = readEmailTokenSecret();
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
      store: await createPaidAccessStore(invocationId),
      adapter,
      now: () => new Date(),
      appOrigin: resolveAppOrigin(config),
      fromEmail: config.fromEmail as string,
      fromName: config.fromName,
      replyTo: config.replyTo as string,
      tokenSecret,
      hash: hashAccessToken,
    },
  };
}
