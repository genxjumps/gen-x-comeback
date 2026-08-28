import { evaluateMarketingSyncGate } from "@/lib/marketing/config.server";
import { dispatchMarketingSyncJobs } from "@/lib/marketing/dispatch";
import { createMailerLiteAdapter } from "@/lib/marketing/mailerlite.server";
import { createSupabaseMarketingSyncStore } from "@/lib/marketing/store.server";
import type { MarketingSyncSummary } from "@/lib/marketing/types";

export type ProductionMarketingSyncResult =
  | ({ enabled: true } & MarketingSyncSummary)
  | {
      enabled: false;
      reason: "disabled" | "missing_configuration";
      missing: string[];
      claimed: 0;
    };

export async function runProductionMarketingSync(): Promise<ProductionMarketingSyncResult> {
  const gate = evaluateMarketingSyncGate();
  if (!gate.enabled) return { ...gate, claimed: 0 };

  const summary = await dispatchMarketingSyncJobs(
    {
      store: await createSupabaseMarketingSyncStore(),
      adapter: createMailerLiteAdapter(gate.apiToken),
      groupId: gate.groupId,
      now: () => new Date(),
    },
    { limit: 5 },
  );
  return { enabled: true, ...summary };
}
