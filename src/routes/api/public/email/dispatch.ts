// Durable outbox worker endpoint. Called by a scheduler (pg_cron via pg_net)
// or manually. No provider call ever happens inside the plan transaction.
//
// Authorization is a dedicated server-only shared secret, presented ONLY as
// `Authorization: Bearer <secret>`. Supabase anon/publishable keys are never
// accepted, and the `apikey` header is ignored entirely.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

function unauthorized(): Response {
  return new Response("unauthorized", {
    status: 401,
    headers: { "cache-control": "no-store" },
  });
}

/** Constant-time compare over equal-length digests (raw lengths never leak). */
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function authorize(request: Request): boolean {
  const expected = process.env["EMAIL_DISPATCH_SECRET"];
  if (typeof expected !== "string" || expected.trim().length === 0) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const match = /^Bearer[ ]+(.+)$/.exec(header.trim());
  if (!match) return false;

  const provided = match[1]!.trim();
  if (provided.length === 0) return false;

  return secretsMatch(provided, expected.trim());
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
