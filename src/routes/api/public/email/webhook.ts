// Signed provider delivery webhook. An invalid signature changes nothing.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/email/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const headers = {
          id: request.headers.get("svix-id"),
          timestamp: request.headers.get("svix-timestamp"),
          signature: request.headers.get("svix-signature"),
        };

        const secret = process.env["EMAIL_WEBHOOK_SECRET"] ?? null;
        const providerKey = process.env["EMAIL_PROVIDER"] ?? "resend";

        const { handleProviderWebhook } = await import("@/lib/email/webhook.server");
        const result = await handleProviderWebhook(rawBody, headers, secret, providerKey);
        return new Response(result.body, { status: result.status });
      },
    },
  },
});
