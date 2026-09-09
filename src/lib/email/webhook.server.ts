// Signed provider webhook reconciliation. Idempotent and out-of-order safe.
import {
  mapProviderEvent,
  verifyWebhookSignature,
  type SignatureHeaders,
} from "@/lib/email/webhook-signature";
import { deliveredEventName } from "@/lib/email/event-names";
import { PLAN_READY_JOB_TYPE } from "@/lib/email/types";

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

  async function closeEventRow(
    jobId: string | null,
    reconciled: boolean,
    paidAccessJobId: string | null = null,
  ): Promise<void> {
    if (!eventRowId) return;
    await supabaseAdmin
      .from("email_provider_events")
      .update({
        ...(jobId ? { job_id: jobId, matched_at: nowIso } : {}),
        ...(paidAccessJobId ? { paid_access_job_id: paidAccessJobId, matched_at: nowIso } : {}),
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
    .select("job_id, job_type, lead_plan_id")
    .eq("provider_key", providerKey)
    .eq("provider_message_id", event.providerMessageId)
    .limit(1);
  if (error) throw new Error(error.message);
  const job = jobs?.[0];

  if (!job) {
    const { data: paidJobs, error: paidJobError } = await supabaseAdmin
      .from("paid_access_email_jobs")
      .select("job_id, customer_id")
      .eq("provider_key", providerKey)
      .eq("provider_message_id", event.providerMessageId)
      .limit(1);
    if (paidJobError) throw new Error(paidJobError.message);
    const paidJob = paidJobs?.[0];

    // Early event: the accepting attempt has not written its message id yet.
    // The row stays unreconciled and the paid dispatcher applies it on acceptance.
    if (!paidJob) {
      const { signupRpc } = await import("@/lib/signup-recovery.server");
      const db = supabaseAdmin as unknown as {
        from(name: string): ReturnType<typeof supabaseAdmin.from>;
      };
      const { data: welcomeJobs, error: welcomeError } = await db
        .from("lead_intake_welcome_jobs")
        .select("job_id")
        .eq("provider_key", providerKey)
        .eq("provider_message_id", event.providerMessageId)
        .limit(1);
      if (welcomeError) throw new Error("welcome_webhook_lookup_failed");
      const welcome = welcomeJobs?.[0] as unknown as { job_id: string } | undefined;
      if (!welcome) return { status: 200, body: "unmatched", applied: false };
      const applied = await signupRpc<boolean>("reconcile_signup_welcome_events", {
        p_job_id: welcome.job_id,
      });
      return { status: 200, body: "ok", applied };
    }

    const paidClient = supabaseAdmin as unknown as {
      rpc(
        fn: "apply_paid_access_delivery_event",
        args: { p_job_id: string; p_kind: string; p_occurred_at?: string },
      ): PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
    };
    const { data: paidApplied, error: paidApplyError } = await paidClient.rpc(
      "apply_paid_access_delivery_event",
      {
        p_job_id: paidJob.job_id,
        p_kind: terminalKind,
        ...(event.occurredAt ? { p_occurred_at: event.occurredAt } : {}),
      },
    );
    if (paidApplyError) throw new Error(paidApplyError.message);
    await closeEventRow(null, true, paidJob.job_id);

    if (event.suppression) {
      const { data: accounts } = await supabaseAdmin
        .from("customer_accounts")
        .select("email_normalized")
        .eq("id", paidJob.customer_id)
        .limit(1);
      const emailNormalized = accounts?.[0]?.email_normalized;
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
    }

    return paidApplied === true
      ? { status: 200, body: "applied", applied: true }
      : { status: 200, body: "stale", applied: false };
  }

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

  // The shared delivery transition emits the Plan Ready name; every other job
  // type owns its own canonical namespace, derived from trusted job state only.
  if (applied === true && terminalKind === "delivered") {
    const expected = deliveredEventName(job.job_type);
    const planReadyName = deliveredEventName(PLAN_READY_JOB_TYPE);
    if (expected && planReadyName && expected !== planReadyName) {
      await supabaseAdmin
        .from("canonical_events")
        .update({ event_name: expected })
        .eq("job_id", job.job_id)
        .eq("event_name", planReadyName);
    }
  }

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
