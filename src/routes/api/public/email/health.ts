import { createFileRoute } from "@tanstack/react-router";
import { emailHealthIsReady } from "@/lib/email/health";

export const Route = createFileRoute("/api/public/email/health")({
  server: {
    handlers: {
      GET: async () => {
        let ready = false;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const [control, cron, alerts] = await Promise.all([
            supabaseAdmin
              .from("email_production_control")
              .select("sending_enabled,paid_access_sending_enabled")
              .eq("singleton_id", 1)
              .limit(1),
            supabaseAdmin
              .from("email_scheduler_invocations")
              .select("completed_at,invoked_at,dispatch_succeeded")
              .eq("source", "cron")
              .not("completed_at", "is", null)
              .order("invoked_at", { ascending: false })
              .limit(1),
            supabaseAdmin
              .from("operational_alerts")
              .select("id")
              .like("alert_type", "email_queue_failure:%")
              .is("resolved_at", null)
              .limit(1),
          ]);
          if (control.error || cron.error || alerts.error) throw new Error("health_unavailable");
          ready = emailHealthIsReady({
            sending: control.data?.[0]?.sending_enabled === true,
            paidSending: control.data?.[0]?.paid_access_sending_enabled === true,
            unresolvedIncidents: Boolean(alerts.data?.length),
            lastCron: cron.data?.[0] ?? null,
          });
        } catch {
          /* Unavailable evidence must never report healthy. */
        }
        return Response.json(
          { status: ready ? "healthy" : "attention_required" },
          { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
