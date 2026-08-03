// Wires deployment configuration, the Supabase store, and the chosen provider
// adapter into dispatcher dependencies. Server-only, fail-closed.
import { createFakeAdapter, createResendAdapter } from "@/lib/email/adapters.server";
import { evaluateSendingGate, readEmailConfig, resolveAppOrigin } from "@/lib/email/config.server";
import { createSupabaseEmailStore } from "@/lib/email/store.server";
import type { DispatchDeps } from "@/lib/email/dispatch";
import { generateAccessToken, hashAccessToken } from "@/lib/lead-plan";
import type { EmailAdapter } from "@/lib/email/types";

export type RuntimeDeps =
  | { enabled: true; deps: DispatchDeps }
  | { enabled: false; missing: string[] };

export async function buildDispatchDeps(): Promise<RuntimeDeps> {
  const config = readEmailConfig();
  const gate = evaluateSendingGate(config);
  if (!gate.enabled) return { enabled: false, missing: gate.missing };

  const adapter: EmailAdapter =
    config.providerKey === "fake"
      ? createFakeAdapter()
      : createResendAdapter(config.providerApiKey as string);

  return {
    enabled: true,
    deps: {
      store: await createSupabaseEmailStore(),
      adapter,
      now: () => new Date(),
      appOrigin: resolveAppOrigin(config),
      fromEmail: config.fromEmail as string,
      fromName: config.fromName,
      replyTo: config.replyTo as string,
      generateToken: generateAccessToken,
      hash: hashAccessToken,
    },
  };
}
