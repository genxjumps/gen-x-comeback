export async function reportQueueHealth(queue: string, operation: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const type = "email_queue_failure:" + queue;
  if (operation) {
    console.error("email_queue_failure", { queue, operation });
    const { data, error } = await supabaseAdmin
      .from("operational_alerts")
      .select("id")
      .eq("alert_type", type)
      .is("resolved_at", null)
      .limit(1);
    if (error) throw new Error("email_queue_alert_read_failed");
    if (!data?.length) {
      const { error: insertError } = await supabaseAdmin.from("operational_alerts").insert({
        alert_type: type,
        severity: "warning",
        details: { queue, operation },
      });
      if (insertError) throw new Error("email_queue_alert_write_failed");
    }
  } else {
    // Avoid clearing a concurrent/new incident or a claim whose lease is still live.
    const cutoff = new Date(Date.now() - 120_000).toISOString();
    const { error } = await supabaseAdmin
      .from("operational_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("alert_type", type)
      .is("resolved_at", null)
      .lt("created_at", cutoff);
    if (error) throw new Error("email_queue_alert_resolve_failed");
  }
}
