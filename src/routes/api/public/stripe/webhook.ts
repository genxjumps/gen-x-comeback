import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("invalid signature", { status: 400 });

        const rawBody = await request.text();
        const { readStripeCheckoutConfig } = await import("@/lib/commerce/stripe-config.server");
        const { constructStripeWebhookEvent, fulfillAcceleratorCheckout } =
          await import("@/lib/commerce/stripe-checkout.server");
        try {
          const config = readStripeCheckoutConfig({ requireWebhookSecret: true });
          const event = await constructStripeWebhookEvent({ config, rawBody, signature });
          if (event.type !== "checkout.session.completed")
            return Response.json({ received: true, handled: false });

          try {
            const result = await fulfillAcceleratorCheckout({
              config,
              sessionId: event.data.object.id,
            });
            return Response.json({
              received: true,
              handled: true,
              replayed: result.replayed,
            });
          } catch {
            return new Response("fulfillment failed", { status: 500 });
          }
        } catch {
          return new Response("invalid event", { status: 400 });
        }
      },
    },
  },
});
