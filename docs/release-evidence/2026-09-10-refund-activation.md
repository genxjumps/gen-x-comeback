# Controlled refund activation status

The initial sections below record the state at PR #96. The September 10 continuation at the end
supersedes that initial pending checklist. It records the successful main sandbox refund flow,
while retaining the signed-event replay and second source-drift checks as open.

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

## September 10 continuation: main refund flow passed

After PR #96 merged, Git sync restored agreement at
`4d8aff69d7d8aa28abb25f77044dd5d4a3c4a85c`. The previously divergent files were independently
byte-compared before the separately approved Edge deployment. The app remained at the verified
`f8f10a38b111d777fa15c7e7a1ce9bdf1d4f6ab9` release, with the same source fingerprint as the
docs-only PR #96 release. A fresh production read at 13:27 UTC returned HTTP 200, no-store, that
commit, and `sha256:1d9dbcbaf79a9f821b01447254be809243f9514eb3bf493bee529efd27d06fdf`.

### Reviewed Edge deployment

The authorized Cloud operation deployed only `accelerator-stripe`, once, and returned
`Successfully deployed edge functions: accelerator-stripe`. Before deployment these files matched
the reviewed source byte for byte:

| File                                               | SHA-256                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `supabase/functions/accelerator-stripe/index.ts`   | `ada4acb053c3cc868667a346378fe20f32c00894fcd04b56a7230d31f1c036a2` |
| `supabase/functions/accelerator-stripe/refunds.ts` | `0cdb640b75886abf1519e0710694e62aed9ee68c088f7d778e243200ec27353e` |
| `supabase/config.toml`                             | `4f6e1de06c10e4b7300badd18eea08b4d70499e177f0c96430b881e5a6f7002b` |

Independent unauthenticated probes returned GET 405 and POST 401. The subsequent refund receipt
provides refund-path runtime evidence. Cloud did not expose a deployed bundle digest, version, or
deployment timestamp, so those are not independently verified. No other function was deployed.

### Controlled operations and observed outcome

Todd saved the existing sandbox webhook with `checkout.session.completed`, `charge.refunded`,
`refund.created`, `refund.updated`, and `refund.failed`. The existing endpoint remained
`https://app.genxjumps.com/api/public/stripe/webhook`. No signing-secret change was requested.

The recovery email initially waited behind the exhausted shared rolling provider cap. Under Todd's
explicit approval, `provider_submission_limit` increased from 10 to 25 and the existing scheduler
was awakened once. Job `5f484031-928b-4327-9bd4-fdbc3cc55030` reached provider acceptance on its
first attempt at approximately 13:00:36 UTC; Todd opened the link and reached the app.
The limit remains 25. `sending_enabled`, `paid_access_sending_enabled`, and the preexisting
`paid_access_customers_admitted` remain true; `genuine_plans_admitted` remains false.

| Evidence                                | Observed value                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| Purchase                                | `127a6502-e345-44d5-b321-910e0c8215c3`                                           |
| Checkout Session                        | `cs_test_a1e5FlAbjQz3Y1BJfT13mK2KMY98jy8McWySqcdOjvS31cyD7BRL2UnqvF`             |
| Stripe charge                           | `ch_3UCKqIDeB3yEvDx91qAxDCNJ`                                                    |
| Stripe refund                           | `re_3UCKqIDeB3yEvDx910Xv65nv`                                                    |
| Amount                                  | 3700 USD cents, sandbox                                                          |
| Request                                 | `51a0397e-e7bc-461e-ae74-db5a6df41c2f`                                           |
| Requested                               | 2026-09-10 13:02:48.234855 UTC                                                   |
| Request deadline                        | 2026-09-12 14:45:18 UTC                                                          |
| Confirmed                               | 2026-09-10 13:06:46.997924 UTC                                                   |
| Purchase and request                    | Both refunded                                                                    |
| Entitlement                             | Revoked at 2026-09-10 13:06:46.972583 UTC                                        |
| Existing run                            | `3a7922c4-285d-4a3f-b21a-cc4a4b2ec92e`, run 1, revoked; snapshot remains present |
| Unrevoked access tokens for entitlement | 0                                                                                |

These database facts were independently queried after Todd issued the full sandbox refund. Todd
confirmed the customer screen displayed the Stripe-confirmed refund and ended access. After
switching from the test customer to the separately authorized reviewer via secure recovery, Todd
pasted the private queue with the matching request, Checkout Session, deadline, and confirmation.
No second refund is needed for this purchase.

The original program run and snapshot remain saved. No complete pre-refund hash/count baseline was
captured for measurement, nutrition, or completion history. Broader preservation, partial/pending/
failed/canceled handling, and replay remain covered by isolated tests; this one provider test is not
evidence of every case. An intentional signed-event resend and its delivery response remain uncaptured.

### Second source drift and remaining work

A later operational tool-discovery message caused a second unpublished Lovable commit,
`13634daf94d913fee9010812cba83c126fc926a5`. Fresh authenticated reads against GitHub `4d8aff6`
showed exactly two changed files: extra unprefixed public Supabase configuration in `.env`, and
formatting/timer changes in `src/integrations/supabase/previewAuthStorage.ts`. These changes are
not adopted. The deployed app still reports the verified release above.

- Capture one intentional signed Stripe event replay and compare the existing receipt and history;
  never issue a second refund or simulate provider evidence through database writes.
- After the next approved GitHub merge and normal Git sync, verify complete Lovable/release SHA
  agreement and file parity. If sync does not restore agreement, stop before deployment and
  investigate a supported sync path. Do not repair through Lovable chat or rewrite Git history.
- Keep [issue #98](https://github.com/genxjumps/gen-x-comeback/issues/98) open until those checks are
  completed and recorded. Account-management follow-up is [issue #97](https://github.com/genxjumps/gen-x-comeback/issues/97).

Both refund migrations are already applied and must not be reapplied. Public intake and live Stripe
mode remain closed; publication, provider operations, and launch retain their approval boundaries.
