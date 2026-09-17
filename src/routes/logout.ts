import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/logout")({
  server: {
    handlers: {
      GET: () => new Response(null, { status: 405 }),
      POST: async ({ request }) => {
        const { logoutBrowserSession } = await import("@/lib/account/logout.server");
        return logoutBrowserSession(request);
      },
    },
  },
});
