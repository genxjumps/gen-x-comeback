// Provider adapters. Server-only: never import from client code.
import type { EmailAdapter, EmailSendRequest, EmailSendResult } from "@/lib/email/types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Resend-compatible adapter: stable idempotency key plus signed webhooks. */
export function createResendAdapter(apiKey: string, fetchImpl: typeof fetch = fetch): EmailAdapter {
  return {
    key: "resend",
    async send(request: EmailSendRequest): Promise<EmailSendResult> {
      try {
        const response = await fetchImpl(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            // Stable logical idempotency key: reused unchanged on every attempt.
            "idempotency-key": request.idempotencyKey,
          },
          body: JSON.stringify({
            from: `${request.fromName} <${request.fromEmail}>`,
            to: [request.to],
            reply_to: request.replyTo,
            subject: request.subject,
            html: request.html,
            text: request.text,
            headers: { "X-Entity-Ref-ID": request.correlationId },
          }),
        });

        if (response.ok) {
          const payload = (await response.json()) as { id?: string };
          if (!payload.id) return { outcome: "ambiguous", errorCode: "missing_provider_message_id" };
          return {
            outcome: "accepted",
            providerKey: "resend",
            providerMessageId: payload.id,
            acceptedAt: new Date().toISOString(),
          };
        }

        if (response.status === 429 || response.status >= 500) {
          return { outcome: "transient", errorCode: `http_${response.status}` };
        }
        return { outcome: "permanent", errorCode: `http_${response.status}` };
      } catch (error) {
        const message = error instanceof Error ? error.name : "network_error";
        // A timeout or dropped connection is ambiguous: the provider may have accepted it.
        return { outcome: "ambiguous", errorCode: message };
      }
    },
  };
}

export type FakeAdapterScript = EmailSendResult[];

export type FakeAdapter = EmailAdapter & {
  requests: EmailSendRequest[];
  lookups: string[];
  /** Results consumed in order; the last result repeats once exhausted. */
  script: FakeAdapterScript;
  reconcileResult: { providerMessageId: string; acceptedAt: string } | null;
};

/** Deterministic adapter for automated acceptance tests. */
export function createFakeAdapter(options?: {
  script?: FakeAdapterScript;
  key?: string;
  reconcileResult?: { providerMessageId: string; acceptedAt: string } | null;
}): FakeAdapter {
  const adapter: FakeAdapter = {
    key: options?.key ?? "fake",
    requests: [],
    lookups: [],
    script: options?.script ?? [],
    reconcileResult: options?.reconcileResult ?? null,
    async send(request) {
      adapter.requests.push(request);
      const index = Math.min(adapter.requests.length - 1, adapter.script.length - 1);
      const scripted = adapter.script[index];
      return (
        scripted ?? {
          outcome: "accepted",
          providerKey: adapter.key,
          providerMessageId: `fake-${adapter.requests.length}`,
          acceptedAt: new Date().toISOString(),
        }
      );
    },
    async lookupByIdempotencyKey(idempotencyKey) {
      adapter.lookups.push(idempotencyKey);
      return adapter.reconcileResult;
    },
  };
  return adapter;
}
