// Durable outbox worker endpoint. Called by a scheduler (pg_cron via pg_net)
// or manually. No provider call ever happens inside the plan transaction.
import { createFileRoute } from "@tanstack/react-router";

function unauthorized(): Response {
  return new Response("unauthorized", { status: 401 });
}

function authorize(request: Request): boolean {
  const expected = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!expected) return false;
  const provided =
    request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return provided.length > 0 && provided === expected;
}

export const Route = createFileRoute("/api/public/email/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorize(request)) return unauthorized();

        const { buildDispatchDeps } = await import("@/lib/email/runtime.server");
        const runtime = await buildDispatchDeps();

        if (!runtime.enabled) {
          // Fail-closed: no provider attempt while prerequisites are missing.
          return Response.json(
            { sending_enabled: false, missing_configuration: runtime.missing, claimed: 0 },
            { status: 200 },
          );
        }

        const { dispatchPlanReadyJobs, raiseStalePlanReadyAlerts } = await import(
          "@/lib/email/dispatch"
        );
        const summary = await dispatchPlanReadyJobs(runtime.deps, { limit: 25 });
        const staleAlerts = await raiseStalePlanReadyAlerts(runtime.deps);

        return Response.json({ sending_enabled: true, ...summary, stale_alerts: staleAlerts });
      },
    },
  },
});
