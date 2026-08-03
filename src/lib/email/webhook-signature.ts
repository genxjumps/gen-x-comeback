// Resend-compatible (Svix) webhook signature verification. Pure and testable.
import { createHmac, timingSafeEqual } from "node:crypto";

export type SignatureHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export const WEBHOOK_TOLERANCE_SECONDS = 60 * 5;

/**
 * Verifies `svix-signature` over `${id}.${timestamp}.${body}`.
 * Returns false for any missing, malformed, stale, or mismatched signature.
 */
export function verifyWebhookSignature(
  secret: string | null,
  headers: SignatureHeaders,
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.timestamp}.${body}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected, "utf8");

  for (const part of headers.signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    const candidate = Buffer.from(value, "utf8");
    if (candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer)) {
      return true;
    }
  }
  return false;
}

export type CanonicalWebhookEvent = {
  kind: "delivered" | "delayed" | "bounced" | "complained" | "reporting" | "ignored";
  providerMessageId: string | null;
  occurredAt: string | null;
  /** Hard bounces and complaints are safety suppressions. */
  suppression: "hard_bounce" | "complaint" | null;
};

/** Maps provider-specific event names onto canonical delivery states. */
export function mapProviderEvent(payload: unknown): CanonicalWebhookEvent {
  const event = (payload ?? {}) as {
    type?: unknown;
    created_at?: unknown;
    data?: { email_id?: unknown; bounce?: { type?: unknown } };
  };
  const type = typeof event.type === "string" ? event.type : "";
  const providerMessageId = typeof event.data?.email_id === "string" ? event.data.email_id : null;
  const occurredAt = typeof event.created_at === "string" ? event.created_at : null;
  const base = { providerMessageId, occurredAt, suppression: null } as const;

  switch (type) {
    case "email.delivered":
      return { ...base, kind: "delivered" };
    case "email.delivery_delayed":
      return { ...base, kind: "delayed" };
    case "email.bounced": {
      const bounceType = String(event.data?.bounce?.type ?? "hard").toLowerCase();
      // Only a hard bounce suppresses the address.
      return {
        providerMessageId,
        occurredAt,
        kind: "bounced",
        suppression: bounceType.includes("soft") ? null : "hard_bounce",
      };
    }
    case "email.complained":
      return { providerMessageId, occurredAt, kind: "complained", suppression: "complaint" };
    case "email.opened":
    case "email.clicked":
      // Reporting only: never verification, never a plan-state change.
      return { ...base, kind: "reporting" };
    default:
      return { ...base, kind: "ignored" };
  }
}

/** Terminal delivery states can never be moved backward by a late event. */
export function canApplyDeliveryTransition(
  current: "pending" | "delivered" | "delayed" | "bounced" | "complained",
  next: "delivered" | "delayed" | "bounced" | "complained",
): boolean {
  if (current === "complained") return false;
  if (current === "bounced") return next === "complained";
  if (current === "delivered") return next === "bounced" || next === "complained";
  return true;
}
