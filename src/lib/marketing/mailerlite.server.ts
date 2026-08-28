import type {
  MarketingAdapter,
  MarketingSyncRequest,
  MarketingSyncResult,
} from "@/lib/marketing/types";

const MAILERLITE_SUBSCRIBERS_ENDPOINT = "https://connect.mailerlite.com/api/subscribers";
const MAILERLITE_API_VERSION = "2026-08-28";

function mailerLiteDate(isoDate: string): string {
  return new Date(isoDate).toISOString().replace("T", " ").slice(0, 19);
}

function retryAfterMs(response: Response): number | undefined {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

/**
 * Upserts by email and adds one group without removing other groups. Deliberately
 * omits `status` and `resubscribe`, so this app never reactivates a subscriber
 * whom MailerLite already considers unsubscribed, bounced, or junk.
 */
export function createMailerLiteAdapter(
  apiToken: string,
  fetchImpl: typeof fetch = fetch,
): MarketingAdapter {
  return {
    key: "mailerlite",
    async upsertSubscriber(request: MarketingSyncRequest): Promise<MarketingSyncResult> {
      try {
        const response = await fetchImpl(MAILERLITE_SUBSCRIBERS_ENDPOINT, {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${apiToken}`,
            "content-type": "application/json",
            "x-version": MAILERLITE_API_VERSION,
          },
          body: JSON.stringify({
            email: request.email,
            fields: { name: request.firstName },
            groups: [request.groupId],
            opted_in_at: mailerLiteDate(request.consentAt),
          }),
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            data?: { id?: string; status?: string | null };
          };
          if (!payload.data?.id) {
            return { outcome: "retry", errorCode: "missing_subscriber_id" };
          }
          return {
            outcome: "accepted",
            subscriberId: payload.data.id,
            subscriberStatus: payload.data.status ?? null,
          };
        }

        if (response.status === 408 || response.status === 429 || response.status >= 500) {
          return {
            outcome: "retry",
            errorCode: `http_${response.status}`,
            retryAfterMs: retryAfterMs(response),
          };
        }
        return { outcome: "permanent", errorCode: `http_${response.status}` };
      } catch (error) {
        return {
          outcome: "retry",
          errorCode: error instanceof Error ? error.name : "network_error",
        };
      }
    },
  };
}
