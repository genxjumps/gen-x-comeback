// Signed provider webhook reconciliation. Idempotent and out-of-order safe.
import {
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
  const terminalKind =
    event.kind === "delivered" ||
    event.kind === "delayed" ||
    event.kind === "bounced" ||
    event.kind === "complained"
      ? event.kind
      : null;

  // Duplicate deliveries are dropped by the unique provider event id. The row is
  // recorded before any state change so an event that arrives before the job
  // knows its provider message id can still be reconciled later.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("email_provider_events")
    .insert({
      provider_key: providerKey,
      provider_event_id: headers.id ?? `${providerKey}:${nowIso}`,
      event_type: String((payload as { type?: unknown }).type ?? "unknown"),
      event_kind: event.kind,
      suppression: event.suppression,
      provider_message_id: event.providerMessageId,
      occurred_at: event.occurredAt,
    })
    .select("id")
    .limit(1);
  if (insertError) {
    if (insertError.code === "23505" || /duplicate key/i.test(insertError.message)) {
      return { status: 200, body: "duplicate", applied: false };
    }
    throw new Error(insertError.message);
  }
  const eventRowId = inserted?.[0]?.id ?? null;

  async function closeEventRow(jobId: string | null, reconciled: boolean): Promise<void> {
    if (!eventRowId) return;
    await supabaseAdmin
      .from("email_provider_events")
      .update({
        ...(jobId ? { job_id: jobId, matched_at: nowIso } : {}),
        ...(reconciled ? { reconciled_at: nowIso } : {}),
      })
      .eq("id", eventRowId);
  }

  if (!terminalKind || !event.providerMessageId) {
    // Reporting-only and unknown events never change plan or delivery state.
    await closeEventRow(null, true);
    return { status: 200, body: "recorded", applied: false };
  }

  const { data: jobs, error } = await supabaseAdmin
    .from("email_jobs")
    .select("job_id, lead_plan_id")
    .eq("provider_key", providerKey)
    .eq("provider_message_id", event.providerMessageId)
    .limit(1);
  if (error) throw new Error(error.message);
  const job = jobs?.[0];

  // Early event: the accepting attempt has not written its message id yet. The
  // row stays unreconciled and the dispatcher applies it on acceptance.
  if (!job) return { status: 200, body: "unmatched", applied: false };

  // One transaction performs the rank guard, the state change, and the
  // delivered canonical event, so a late or duplicate event cannot regress it.
  const { data: applied, error: applyError } = await supabaseAdmin.rpc(
    "apply_email_delivery_event",
    {
      p_job_id: job.job_id,
      p_kind: terminalKind,
      ...(event.occurredAt ? { p_occurred_at: event.occurredAt } : {}),
    },
  );
  if (applyError) throw new Error(applyError.message);
  await closeEventRow(job.job_id, true);

  if (event.suppression) {
    const { data: leads } = await supabaseAdmin
      .from("lead_plans")
      .select("email_normalized")
      .eq("id", job.lead_plan_id)
      .limit(1);
    const emailNormalized = leads?.[0]?.email_normalized;
    if (emailNormalized) {
      await supabaseAdmin.from("email_suppressions").upsert(
        {
          email_normalized: emailNormalized,
          reason: event.suppression,
          source: "provider_webhook",
        },
        { onConflict: "email_normalized,reason" },
      );
    }
    // Safety suppression blocks unsafe sending; plan access is never removed.
    await supabaseAdmin
      .from("lead_plans")
      .update({ email_suppressed_at: nowIso, email_suppression_reason: event.suppression })
      .eq("id", job.lead_plan_id);
  }

  if (applied !== true) return { status: 200, body: "stale", applied: false };
  return { status: 200, body: "applied", applied: true };
}
