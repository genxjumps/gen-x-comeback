import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("invalid signature", { status: 400 });

        const rawBody = await request.text();
        const { forwardStripeWebhookToEdge } = await import("@/lib/commerce/stripe-edge.server");
        return forwardStripeWebhookToEdge({ rawBody, signature });
      },
    },
  },
});
