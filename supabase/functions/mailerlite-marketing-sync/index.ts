declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type EdgeConfig = {
  enabled: boolean;
  enableFlagPresent: boolean;
  apiToken: string | null;
  groupId: string | null;
  serviceRoleKey: string | null;
};

type UpsertRequest = {
  action: "upsert";
  subscriber: {
    email: string;
    firstName: string;
    consentAt: string;
  };
};

const MAILERLITE_SUBSCRIBERS_ENDPOINT = "https://connect.mailerlite.com/api/subscribers";
const MAILERLITE_API_VERSION = "2026-08-28";

function env(name: string): string | null {
  const value = Deno.env.get(name);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readConfig(): EdgeConfig {
  const enableFlag = env("MARKETING_SYNC_ENABLED");
  return {
    enabled: enableFlag?.toLowerCase() === "true",
    enableFlagPresent: enableFlag !== null,
    apiToken: env("MAILERLITE_API_TOKEN"),
    groupId: env("MAILERLITE_GROUP_ID"),
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer[ ]+(.+)$/.exec(header.trim()) : null;
  return match?.[1]?.trim() || null;
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secretsMatch(provided: string | null, expected: string | null): Promise<boolean> {
  if (!provided || !expected) return false;
  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

function configuration(config: EdgeConfig) {
  return {
    enable_flag_present: config.enableFlagPresent,
    api_token_present: config.apiToken !== null,
    group_id_present: config.groupId !== null,
    group_id_valid: config.groupId !== null && /^[0-9]+$/.test(config.groupId),
  };
}

function gate(config: EdgeConfig) {
  if (!config.enabled) {
    return {
      enabled: false as const,
      reason: "disabled" as const,
      missing: [] as string[],
      configuration: configuration(config),
    };
  }

  const missing: string[] = [];
  if (!config.apiToken) missing.push("MAILERLITE_API_TOKEN");
  if (!config.groupId || !/^[0-9]+$/.test(config.groupId)) missing.push("MAILERLITE_GROUP_ID");
  if (missing.length > 0) {
    return {
      enabled: false as const,
      reason: "missing_configuration" as const,
      missing,
      configuration: configuration(config),
    };
  }

  return { enabled: true as const, configuration: configuration(config) };
}

function validUpsertRequest(value: unknown): value is UpsertRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.action !== "upsert") return false;
  if (
    !record.subscriber ||
    typeof record.subscriber !== "object" ||
    Array.isArray(record.subscriber)
  )
    return false;
  const subscriber = record.subscriber as Record<string, unknown>;
  if (Object.keys(subscriber).some((key) => !["email", "firstName", "consentAt"].includes(key)))
    return false;
  return (
    typeof subscriber.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subscriber.email) &&
    typeof subscriber.firstName === "string" &&
    subscriber.firstName.trim().length > 0 &&
    typeof subscriber.consentAt === "string" &&
    Number.isFinite(new Date(subscriber.consentAt).getTime())
  );
}

function mailerLiteDate(isoDate: string): string {
  return new Date(isoDate).toISOString().replace("T", " ").slice(0, 19);
}

function retryAfterMs(response: Response): number | undefined {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

async function upsertSubscriber(request: UpsertRequest, config: EdgeConfig): Promise<Response> {
  try {
    const response = await fetch(MAILERLITE_SUBSCRIBERS_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.apiToken!}`,
        "content-type": "application/json",
        "x-version": MAILERLITE_API_VERSION,
      },
      body: JSON.stringify({
        email: request.subscriber.email,
        fields: { name: request.subscriber.firstName },
        groups: [config.groupId!],
        opted_in_at: mailerLiteDate(request.subscriber.consentAt),
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        data?: { id?: string; status?: string | null };
      };
      if (!payload.data?.id) return json({ outcome: "retry", errorCode: "missing_subscriber_id" });
      return json({
        outcome: "accepted",
        subscriberId: payload.data.id,
        subscriberStatus: payload.data.status ?? null,
      });
    }

    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      return json({
        outcome: "retry",
        errorCode: `http_${response.status}`,
        retryAfterMs: retryAfterMs(response),
      });
    }
    return json({ outcome: "permanent", errorCode: `http_${response.status}` });
  } catch (error) {
    return json({
      outcome: "retry",
      errorCode: error instanceof Error ? error.name : "network_error",
    });
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const config = readConfig();
  if (!(await secretsMatch(bearer(request), config.serviceRoleKey))) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if ((body as { action?: unknown })?.action === "status") return json(gate(config));

  const currentGate = gate(config);
  if (!currentGate.enabled) return json(currentGate, 503);
  if (!validUpsertRequest(body))
    return json({ outcome: "permanent", errorCode: "invalid_request" }, 400);
  return upsertSubscriber(body, config);
});
