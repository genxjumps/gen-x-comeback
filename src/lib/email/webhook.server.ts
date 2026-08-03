// Signed provider webhook reconciliation. Idempotent and out-of-order safe.
import {
  canApplyDeliveryTransition,
  mapProviderEvent,
  verifyWebhookSignature,
  type SignatureHeaders,
} from "@/lib/email/webhook-signature";

export type WebhookHandleResult =
  | { status: 401; body: string }
  | { status: 200; body: string; applied: boolean };

export async function handleProviderWebhook(
  rawBody: string,
  headers: SignatureHeaders,
  secret: string | null,
  providerKey: string,
): Promise<WebhookHandleResult> {
  // An unsigned or invalidly signed webhook makes no state change at all.
  if (!verifyWebhookSignature(secret, headers, rawBody)) {
    return { status: 401, body: "invalid signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 200, body: "ignored", applied: false };
  }

  const event = mapProviderEvent(payload);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();

  // Duplicate deliveries are dropped by the unique provider event id.
  const { error: insertError } = await supabaseAdmin.from("email_provider_events").insert({
    provider_key: providerKey,
    provider_event_id: headers.id ?? `${providerKey}:${nowIso}`,
    event_type: String((payload as { type?: unknown }).type ?? "unknown"),
    provider_message_id: event.providerMessageId,
    occurred_at: event.occurredAt,
  });
  if (insertError) {
    if (insertError.code === "23505" || /duplicate key/i.test(insertError.message)) {
      return { status: 200, body: "duplicate", applied: false };
    }
    throw new Error(insertError.message);
  }

  if (event.kind === "ignored" || event.kind === "reporting" || !event.providerMessageId) {
    return { status: 200, body: "recorded", applied: false };
  }

  const { data: jobs, error } = await supabaseAdmin
    .from("email_jobs")
    .select("job_id, lead_plan_id, plan_version_id, delivery_status")
    .eq("provider_key", providerKey)
    .eq("provider_message_id", event.providerMessageId)
    .limit(1);
  if (error) throw new Error(error.message);
  const job = jobs?.[0];
  if (!job) return { status: 200, body: "unmatched", applied: false };

  if (!canApplyDeliveryTransition(job.delivery_status, event.kind)) {
    return { status: 200, body: "stale", applied: false };
  }

  await supabaseAdmin
    .from("email_jobs")
    .update({
      delivery_status: event.kind,
      ...(event.kind === "delivered" ? { delivered_at: event.occurredAt ?? nowIso } : {}),
      updated_at: nowIso,
    })
    .eq("job_id", job.job_id);

  if (event.kind === "delivered") {
    await supabaseAdmin.from("canonical_events").insert({
      event_name: "email_plan_ready_delivered",
      lead_plan_id: job.lead_plan_id,
      plan_version_id: job.plan_version_id,
      job_id: job.job_id,
      occurred_at: event.occurredAt ?? nowIso,
    });
  }

  if (event.suppression) {
    const { data: leads } = await supabaseAdmin
      .from("lead_plans")
      .select("email_normalized")
      .eq("id", job.lead_plan_id)
      .limit(1);
    const emailNormalized = leads?.[0]?.email_normalized;
    if (emailNormalized) {
      await supabaseAdmin
        .from("email_suppressions")
        .upsert(
          { email_normalized: emailNormalized, reason: event.suppression, source: "provider_webhook" },
          { onConflict: "email_normalized,reason" },
        );
    }
    // Safety suppression blocks unsafe sending; plan access is never removed.
    await supabaseAdmin
      .from("lead_plans")
      .update({ email_suppressed_at: nowIso, email_suppression_reason: event.suppression })
      .eq("id", job.lead_plan_id);
  }

  return { status: 200, body: "applied", applied: true };
}
