# Email queue failures and monitoring

Todd approved isolating recoverable queue failures after a Lovable review identified
that a welcome-step database exception disables the entire sender.

## Failure boundaries

Explicit preparation operations (claims, recipient/state/suppression reads and
idempotent pre-send credential writes) raise a typed recoverable queue error.
Production catches that type at each queue boundary and continues independent
queues. It doesn't immediately retry the failed batch or remove its lease.
Normal scheduler retries, attempt limits and idempotency horizons still apply.
If a higher-priority proactive lifecycle queue fails, lower-priority proactive
queues wait until another cycle. Transactional recovery and purchase queues
remain independent. Staging retains its existing uncaught-error behavior.

Provider calls, final reservations, completion evidence and unknown exceptions
aren't reclassified. They retain the existing global shutdown boundary and its
critical alert. Consent, suppression, activation, controlled scope, provider
volume limits and record ownership remain authoritative database checks.

A partial cycle records a failed invocation with a queue-specific failure code,
returns HTTP 503 with failed queue names and a partial-summary indicator, and
leaves the sending switch on. Counts in partial summaries cover completed queue
summaries only; provider reservations remain authoritative. Healthy independent
queues may already have sent emails, so callers must not blindly retry a whole
cycle. Queue claims and provider idempotency still protect scheduled retries.

## How failures become visible

- Each affected queue writes an unresolved warning to existing operational_alerts
  with only queue and operation names. A read-before-insert avoids repeat alerts
  in normal serial ticks; concurrent ticks can create more than one incident.
- A later successful queue cycle resolves its incidents older than the two-minute
  claim lease. New/concurrent incidents aren't cleared. This records queue recovery,
  not guaranteed delivery of every individual message.
- If incident storage itself fails, log a sanitized monitoring error and mark
  the scheduler cycle failed. A monitoring-write error doesn't stop other queues.
- Existing global shutdown alerts and failed-job alerts remain intact.
- GET /api/public/email/health returns only healthy (HTTP 200) or attention_required
  (HTTP 503), with no-store. It exposes no participant information, queue names,
  credentials or control values.
- Healthy requires both sending switches on, no unresolved queue incident, and a
  successful completed cron invocation within 12 minutes. Manual/immediate wakes
  don't hide a broken cron. An in-flight normal cron doesn't cause a false alarm.
  Missing/unavailable database evidence returns 503.

## Independent alert delivery - setup still required

No external monitor or automatic human notification is configured by this PR.
The database alert flag by itself never meant that someone receives a message.
Before relying on notifications, connect an independently hosted uptime monitor
to https://app.genxjumps.com/api/public/email/health, using one-minute checks and
an alert after two consecutive failures, plus recovery notification. Choose Todd's
destination and verify an end-to-end alert separately. Don't use this same email
dispatcher to send its own outage notification.

A planned sending pause (including PR #104 migration/deployment) intentionally
returns 503; use the monitor's maintenance window during approved work. A prolonged
pause must alert after that window. This endpoint is operational health, not a
promise of inbox delivery or complete failed-job monitoring.

## Release and acceptance

This checkpoint adds no migration or provider configuration. It builds on the
merged PR #103 source, whose migration is still pending. Don't publish this source
before completing the adopted account-recovery migration procedure. PR #104 adoption
remains separate; this work doesn't apply it or change sending/intake controls.

Automated checks cover recoverable preparation failure, continued independent
queues, dependent lifecycle deferral, critical exception propagation, monitoring
failure, disabled gates, stale/missing cron and unresolved incidents. Before calling
notification delivery operational, verify the independently configured monitor
receives a controlled failure and recovery. Don't force live email faults merely
to test the code; use isolated fixtures for provider-boundary failures.
