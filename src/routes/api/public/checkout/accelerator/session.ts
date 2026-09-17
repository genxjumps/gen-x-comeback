import { createFileRoute } from "@tanstack/react-router";

import {
  allowedEmbeddedCheckoutOrigin,
  embeddedCheckoutAttemptLimit,
} from "@/lib/commerce/embedded-checkout-origin";

const CLAIM_COOKIE = "gxj_accelerator_checkout_claim";
const CLAIM_MAX_AGE = 24 * 60 * 60;

function corsHeaders(origin: string): Headers {
  return new Headers({
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-origin": origin,
    "cache-control": "no-store",
    vary: "Origin",
  });
}

function response(origin: string, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}

async function handle(request: Request): Promise<Response> {
  const origin = allowedEmbeddedCheckoutOrigin(request);
  if (!origin) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const { callerBucketKey, consumeRateLimit } = await import("@/lib/email/rate-limit.server");
  const limit = await consumeRateLimit(
    callerBucketKey("embedded_checkout", request),
    3600,
    embeddedCheckoutAttemptLimit(origin),
  );
  if (!limit.allowed) return response(origin, { ok: false, reason: "closed" }, 429);

  const { createStripeEdgeEmbeddedGuestCheckout } =
    await import("@/lib/commerce/stripe-edge.server");
  const result = await createStripeEdgeEmbeddedGuestCheckout();
  if (!result.ok) {
    return response(origin, result, result.reason === "closed" ? 403 : 503);
  }

  const headers = corsHeaders(origin);
  headers.set(
    "set-cookie",
    `${CLAIM_COOKIE}=${result.claimToken}; Path=/; Max-Age=${CLAIM_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
  );
  return Response.json({ ok: true, clientSecret: result.clientSecret }, { headers });
}

export const Route = createFileRoute("/api/public/checkout/accelerator/session")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
