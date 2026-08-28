import type { MarketingAdapter, MarketingSyncRequest, MarketingSyncResult } from "./types";

export type MailerLiteEdgeGate =
  | {
      enabled: true;
      configuration?: Record<string, boolean>;
    }
  | {
      enabled: false;
      reason: "disabled" | "missing_configuration" | "edge_unavailable";
      missing: string[];
      configuration?: Record<string, boolean>;
    };

type EdgeRuntimeConfig = {
  endpoint: string | null;
  serviceRoleKey: string | null;
};

function env(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readMailerLiteEdgeRuntimeConfig(): EdgeRuntimeConfig {
  const supabaseUrl = env("SUPABASE_URL");
  return {
    endpoint: supabaseUrl
      ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/mailerlite-marketing-sync`
      : null,
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function missingRuntimeConfiguration(config: EdgeRuntimeConfig): string[] {
  const missing: string[] = [];
  if (!config.endpoint) missing.push("SUPABASE_URL");
  if (!config.serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

async function invokeEdge(
  config: EdgeRuntimeConfig,
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<{ response: Response; payload: unknown }> {
  if (!config.endpoint || !config.serviceRoleKey) throw new Error("edge_runtime_missing");
  const response = await fetchImpl(config.endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // The caller converts malformed or unavailable responses into a safe retry.
  }
  return { response, payload };
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "boolean")
  );
}

export async function readMailerLiteEdgeGate(
  config: EdgeRuntimeConfig = readMailerLiteEdgeRuntimeConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<MailerLiteEdgeGate> {
  const runtimeMissing = missingRuntimeConfiguration(config);
  if (runtimeMissing.length > 0) {
    return {
      enabled: false,
      reason: "missing_configuration",
      missing: runtimeMissing,
    };
  }

  try {
    const { response, payload } = await invokeEdge(config, { action: "status" }, fetchImpl);
    if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { enabled: false, reason: "edge_unavailable", missing: [] };
    }
    const record = payload as Record<string, unknown>;
    const configuration = isBooleanRecord(record.configuration) ? record.configuration : undefined;
    if (record.enabled === true) return { enabled: true, configuration };
    if (record.enabled !== false) {
      return { enabled: false, reason: "edge_unavailable", missing: [], configuration };
    }
    const reason =
      record.reason === "disabled" || record.reason === "missing_configuration"
        ? record.reason
        : "edge_unavailable";
    const missing = Array.isArray(record.missing)
      ? record.missing.filter((item): item is string => typeof item === "string")
      : [];
    return { enabled: false, reason, missing, configuration };
  } catch {
    return { enabled: false, reason: "edge_unavailable", missing: [] };
  }
}

function isMarketingSyncResult(value: unknown): value is MarketingSyncResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.outcome === "accepted") return typeof record.subscriberId === "string";
  if (record.outcome === "retry" || record.outcome === "permanent") {
    return typeof record.errorCode === "string";
  }
  return false;
}

export function createMailerLiteEdgeAdapter(
  config: EdgeRuntimeConfig = readMailerLiteEdgeRuntimeConfig(),
  fetchImpl: typeof fetch = fetch,
): MarketingAdapter {
  return {
    key: "mailerlite",
    async upsertSubscriber(request: MarketingSyncRequest): Promise<MarketingSyncResult> {
      try {
        const { response, payload } = await invokeEdge(
          config,
          {
            action: "upsert",
            subscriber: {
              email: request.email,
              firstName: request.firstName,
              consentAt: request.consentAt,
            },
          },
          fetchImpl,
        );
        if (isMarketingSyncResult(payload)) return payload;
        return { outcome: "retry", errorCode: `edge_http_${response.status}` };
      } catch {
        return { outcome: "retry", errorCode: "edge_unavailable" };
      }
    },
  };
}
