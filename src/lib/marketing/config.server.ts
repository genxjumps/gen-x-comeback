export type MarketingSyncConfig = {
  enabled: boolean;
  apiToken: string | null;
  groupId: string | null;
};

function env(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readMarketingSyncConfig(): MarketingSyncConfig {
  return {
    enabled: env("MARKETING_SYNC_ENABLED") === "true",
    apiToken: env("MAILERLITE_API_TOKEN"),
    groupId: env("MAILERLITE_GROUP_ID"),
  };
}

export type MarketingSyncGate =
  | { enabled: true; apiToken: string; groupId: string }
  | { enabled: false; reason: "disabled" | "missing_configuration"; missing: string[] };

/** MailerLite is an independent, explicit gate. Resend's send gate does not control it. */
export function evaluateMarketingSyncGate(
  config: MarketingSyncConfig = readMarketingSyncConfig(),
): MarketingSyncGate {
  if (!config.enabled) return { enabled: false, reason: "disabled", missing: [] };

  const missing: string[] = [];
  if (!config.apiToken) missing.push("MAILERLITE_API_TOKEN");
  if (!config.groupId || !/^[0-9]+$/.test(config.groupId)) missing.push("MAILERLITE_GROUP_ID");

  if (missing.length > 0) return { enabled: false, reason: "missing_configuration", missing };
  return { enabled: true, apiToken: config.apiToken!, groupId: config.groupId! };
}
