# Controlled refund activation status

## App publication

The approved app publication passed the controlled preflight and production
identity verifier at release `f8f10a38b111d777fa15c7e7a1ce9bdf1d4f6ab9`.
See `2026-09-10-refund-app-deployment.json` for the exact deployment evidence.
This proves app publication, not the separately hosted Stripe Edge Function.

## Reviewer provisioning and browser checks

Under Todd's approval to continue controlled reviewer setup, the existing main
account was matched to its confirmed auth identity before a guarded transaction
inserted its customer ID into `private_refund_reviewers`. A separate read found
exactly one reviewer, the approved account, zero refund requests, and zero refund
receipts. No identity was created and no purchase or entitlement was changed.
The reviewer queue is read-only; it cannot issue a Stripe refund.

Signed-out browser checks of `/my-programs/accelerator/refund` and `/admin/refunds`
both rendered the secure-access boundary and the closed-public-enrollment notice.
Authenticated customer and reviewer flows remain untested in this checkpoint.

## Edge verification limitation and unexpected Lovable source drift

A plan-mode inspection request explicitly prohibited all source edits, commits,
deployment, configuration changes, and provider/database mutations. The Lovable
agent reported that its Cloud tools could deploy the named function and read logs,
but could not retrieve deployed source, version, timestamp, or bundle digest. It
reported no current function log entries. Repository refund code is present; this
does not establish what is deployed.

Despite the read-only request, Lovable produced commit
`6e76f31c23e7980b3abf153ad6ff340edc3b868e`. The authenticated diff against approved
release `f8f10a38b111d777fa15c7e7a1ce9bdf1d4f6ab9` shows three changed files:

- `.env`: extra unprefixed browser-public Supabase configuration entries.
- `.lovable/plan.md`: replaced plan text, including an inaccurate assertion that
  the inspection made no edits or commits.
- `src/integrations/supabase/previewAuthStorage.ts`: formatting and timer variable
  changes outside the authorized checkpoint.

The source of each incidental change cannot be determined from the agent's
activity log. The diff establishes that they exist. GitHub's release branch still
reported the approved `f8f10a3` commit after this event, while Lovable reported
`6e76f31`. No publish or Edge deployment was requested from that divergent source.

Do not adopt these changes, refresh the manifest to bless them, force-push, or
use another Lovable chat edit to repair them. Reconcile via the GitHub-first
release process, then freshly verify complete source agreement before deployment.
Even a read-only plan-mode chat must not be assumed free of source side effects.

## Remaining activation work

1. Reconcile Lovable source with the approved GitHub release and verify the diff.
2. Deploy the exact reviewed `accelerator-stripe` source through a supported
   controlled path and obtain independent runtime evidence.
3. Configure the existing test-mode signed webhook for the four refund events,
   preserving `checkout.session.completed` and its existing signing secret.
4. Verify the authenticated request and reviewer pages with a controlled purchase.
5. Execute the approved bounded Stripe test refund and verify confirmation,
   revoked access, preserved history, and idempotent replay.

No refund, webhook change, new email, secret change, public intake opening, or
live-mode Stripe activation was performed during this continuation.
