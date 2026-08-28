import { dispatchMarketingSyncJobs } from "@/lib/marketing/dispatch";
import {
  createMailerLiteEdgeAdapter,
  readMailerLiteEdgeGate,
} from "@/lib/marketing/mailerlite-edge.server";
import { createSupabaseMarketingSyncStore } from "@/lib/marketing/store.server";
import type { MarketingSyncSummary } from "@/lib/marketing/types";

export type ProductionMarketingSyncResult =
  | ({ enabled: true } & MarketingSyncSummary)
  | {
      enabled: false;
      reason: "disabled" | "missing_configuration" | "edge_unavailable";
      missing: string[];
      configuration?: Record<string, boolean>;
      claimed: 0;
    };

export async function runProductionMarketingSync(): Promise<ProductionMarketingSyncResult> {
  const gate = await readMailerLiteEdgeGate();
  if (!gate.enabled) return { ...gate, claimed: 0 };

  const summary = await dispatchMarketingSyncJobs(
    {
      store: await createSupabaseMarketingSyncStore(),
      adapter: createMailerLiteEdgeAdapter(),
      // The group ID is resolved only inside the Edge Function. This placeholder
      // is never included in the internal request or the MailerLite payload.
      groupId: "edge-configured",
      now: () => new Date(),
    },
    { limit: 5 },
  );
  return { enabled: true, ...summary };
}
