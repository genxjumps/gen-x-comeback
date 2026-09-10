# Accelerator manual refund requests

## Approved checkpoint

Todd approved manual review on September 10, 2026, following the seven-day
refund-request decision. Base: `release/v1.1` at
`78ffaae1be34bc6ac2790388ac38254a31ac3fd6`.

A customer requests a refund within seven days of the recorded purchase, Todd
reviews it and issues approved refunds in Stripe, and the app ends access from
that purchase only after freshly retrieved Stripe evidence confirms the entire
$37 was successfully refunded. A request, partial refund, pending refund, failed
refund, or canceled refund does not remove access. No progress, measurement,
nutrition, account, or program-snapshot history is deleted.

This checkpoint implements source and isolated tests. It does not apply its
migration, assign a reviewer, issue any refund, enable live Stripe mode, change
webhook subscriptions/secrets, send email, publish, or open enrollment. Those
operations retain their separate approvals. Current Stripe integration is test-only.

## Customer flow

My Programs links to `/my-programs/accelerator/refund`, including after ownership
has been revoked, so an existing signed-in customer can still inspect purchase
status. The page lists only the authenticated account's Stripe Accelerator
purchases, purchase times, local-time deadlines, and request/refund state.

The customer selects **Request a Refund**, then **Send Request**. The database
checks identity, product, purchase source/status, and its own clock. The window
ends at the stored purchase time plus seven days, not at program start. A new
request is accepted through that exact deadline. Requests are unique per purchase;
retries return the original receipt even after the deadline passes. A failure
shows a retry action, never a false receipt. Submission confirmation is in-app;
this checkpoint does not add a request email or promise a review turnaround.

Access remains available during review. The customer sees the confirmed refund
state on returning to or reloading this page. Existing account sessions are not
revoked globally, and other purchases and the free plan are not removed.

## Private review and manual operation

`/admin/refunds` is a read-only queue, ordered with outstanding requests first.
It displays customer email, request time, original deadline, Checkout Session
reference, and confirmation status. It cannot create a refund or change access.
The existing `/admin/customers` progress view remains read-only and does not gain
refund capabilities.

Access requires a separately provisioned entry in `private_refund_reviewers` for
the authenticated account. The migration creates an empty allow-list. Assign
Todd's verified account only through a separately approved, inspected operational
step. There is no public role-grant route and no inherited progress-admin access.

For each approved request:

1. Read the recorded request time. A request received on time remains on time if
   review happens after the deadline.
2. Resolve the exact Checkout Session reference to its paid Stripe PaymentIntent
   and charge. Match the customer, $37 USD amount, and test/live mode before acting.
   The current implementation supports only test objects.
3. Todd issues the full refund in Stripe. The app and its tools never issue money
   movement automatically from a customer click.
4. Refresh the queue after Stripe's webhook is processed. A request remains
   outstanding while provider confirmation is absent; never mark it refunded
   manually to clear the queue.
5. If delivery fails, inspect the webhook result and replay the signed event using
   Stripe's supported delivery tools. Reconciliation re-reads current provider
   objects and is idempotent. An unknown local purchase returns a retryable failure,
   covering refund delivery before purchase fulfillment.

Review decisions that do not result in a Stripe refund require direct customer
follow-up. V1 does not add an in-app denial workflow, staff messaging system, or
refund-decision email. Monitor outstanding requests in this queue; there is no
new staff-notification email. Partial refunds are not a V1 offer, but partial
provider events are handled safely without revoking access.

If Stripe reports a late bank failure after previously confirming a successful
full refund, handle it as a support exception: reconcile the payment in Stripe
and arrange the appropriate remedy. This checkpoint does not automatically
reinstate previously revoked program runs or issue a replacement payment.

## Provider and database boundary

After the reviewed migration and Edge Function are approved for deployment,
subscribe the existing signed Stripe webhook to:

- `checkout.session.completed` (existing)
- `charge.refunded`
- `refund.created`
- `refund.updated`
- `refund.failed`

The Edge Function first authenticates the app proxy and verifies Stripe's
signature and test mode. It retrieves the current charge, finds the associated
Checkout Session via PaymentIntent, verifies the product/version, amount,
currency, and charge/session binding, and consumes every page of refund records.
Only distinct refunds with `status=succeeded` contribute to the full-refund total.
Event bodies are notifications, not trusted snapshots of final refund status.

Refund event handling continues when the checkout-enabled gate is false, provided
the existing provider configuration and signing credentials remain available.
Disabling sales must not stop reconciliation of refunds for earlier purchases.
Unexpected provider/database errors return retryable failures. Unrelated products
are ignored. Live objects remain rejected.

The service-role-only confirmation transaction records one receipt per purchase,
marks the purchase and request refunded, revokes the entitlement only if it still
belongs to that purchase, revokes its active/paused runs, clears only their active
pointer, and revokes their paid-access tokens. Completed history stays recorded.
The existing entitlement checks protect workouts, nutrition, and paid recovery.

Provisioning uses the same customer lock as program start and refund processing.
Replaying a refunded checkout does not reactivate ownership or enqueue access
email. A delayed old refund cannot revoke an entitlement rebound to a newer
purchase. Checkout webhook replays for refunded purchases are acknowledged, while
browser success confirmation refuses to grant access from them.

## Verification and deployment gates

- `bun run refunds:db:types` generates RPC argument types from an isolated complete
  migration replay; `refunds:db:test` verifies them without rewriting files.
- Database acceptance covers account isolation, independent reviewer permissions,
  late requests, timely-request replay after expiry, request idempotency, invalid
  confirmation, missing-purchase retry, history preservation, revoked access,
  checkout replay, and refund-after-repurchase ordering.
- Provider tests execute the reconciliation code with SDK fixtures. Webhook tests
  execute the actual Edge handler with mocked provider/signature boundaries,
  including unsigned proxy rejection, invalid signatures, live events, pending
  states, and retryable failures. They do not contact Stripe or prove a real
  signature delivery or refund settlement.
- The full Quality Gate includes refund database acceptance. Migration application,
  reviewer provisioning, Edge deployment, webhook subscription, and a controlled
  Stripe test refund remain required before live acceptance can be claimed.
- Schema application follows `DATABASE-MIGRATION-PROCESS.md`; the new migration is
  `20260910100000_accelerator_refund_requests.sql`. Existing migrations are immutable.
- Before any application, pair that foundation with
  `20260910110000_accelerator_refund_permissions.sql` in one transaction. The
  forward fix removes inherited non-owner table/function grants, including
  Cloud's sandbox-role grants, and restores only service-role SELECT/INSERT/UPDATE
  on the three tables and EXECUTE on the four refund functions. Owners retain
  database administration. Global default privileges and unrelated objects aren't changed.
- The refund harness runs both clean and observed Cloud default grants, proves
  the original permission gap occurs, and checks actual role denials after the
  fix. `supabase/accelerator-refunds.permissions.sql` provides catalog-only
  post-application assertions. It doesn't create fixtures or contact a provider.
- The proposed [refund Cloud procedure](REFUND-CLOUD-MIGRATION-PROCEDURE.md)
  requires explicit adoption and merge, then separately approved application.
- Public paid launch still requires separate staging and production-mode work.

Provider references: [Stripe refund behavior](https://docs.stripe.com/refunds),
[refund statuses](https://docs.stripe.com/api/refunds/object), and
[Checkout Session lookup by PaymentIntent](https://docs.stripe.com/api/checkout/sessions/list).
