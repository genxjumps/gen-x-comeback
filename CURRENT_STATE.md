# Gen X Jumps App - Current State

**Role:** Current
**Snapshot date:** September 17, 2026
**Current integration branch:** `release/v1.1`

This is the only repository document allowed to describe what is true **now**. Product contracts
define durable behavior. Runbooks define procedures. Historical checkpoints and release evidence do
not define current status.

## Source and deployment identity

| Surface                        | Revision                                                                     | Meaning                                                             |
| ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Active integration source      | Resolve the live `release/v1.1` ref                                          | Do not freeze a self-expiring branch-head SHA in this file          |
| Last audited app-code baseline | `9edba783553d87dc0cc76e4aca5774e4e9b63b61`                                   | Application behavior reviewed before the reset documentation merged |
| Authority checkpoint           | PR #268, merge `a7a2c05216ed5a4ef67d312021ddc643ef993f01`                    | Established current-state and document-authority rules              |
| Preservation branch            | `archive/pre-reset-2026-09-17` at `9edba783553d87dc0cc76e4aca5774e4e9b63b61` | Exact pre-reset recovery point                                      |
| GitHub default branch          | `main` at `42c548a966c0e57fc25cff53a22849783169dc60`                         | Stale baseline pending reconciliation                               |
| Published app during audit     | `e5fd50e5d767bdacdc3a843948748f6ca8d546ac`                                   | Live source reported by `/api/public/release` on September 17, 2026 |

The release branch and published app are deliberately distinct until an approved publication.
The default branch must not be treated as current source until it is reconciled.

## Current operating boundary

- The app remains pre-launch.
- New public 7-Day Plan intake remains fail-closed in source except for approved controlled testing.
- Stripe remains test-mode only. Live keys, live objects, real-money checkout, and public paid
  enrollment remain closed.
- Broad customer email and genuine-customer admission remain controlled by their existing gates.
- Database migration application, migration-history repair, provider configuration, publication,
  and launch remain separately approved operations.
- GitHub is the source of truth. Lovable is a controlled review and publication surface.

## Implemented in current source

- Free personalized 7-Day Plan intake, assessment, saved plan, sequential progression, completion,
  return access, and recovery.
- Portable passwordless recovery links with multiple valid sessions and cross-device use.
- Unified customer-account foundation linking free-plan access and paid ownership.
- Permanent ownership of the `accelerator_28_v1` 28-Day Fat Loss Accelerator.
- Not Started, Active, Paused, and Completed program-run behavior with repeatable versioned runs.
- Sequential 28-day progression, missed-day persistence, safe switching, completed-day reopening,
  bounded Undo, and video viewing separate from completion.
- Optional weight and waist history.
- Programs, Progress, Nutrition, Notifications, Account, and purchase/refund surfaces.
- Controlled Stripe test checkout, guest purchase handoff, signed verification, and test refund
  reconciliation.
- Account-level Nutrition access for qualifying paid ownership, independent of active program
  progress.
- A review catalog for controlled visual and copy review.

## Locked product decisions to preserve

- The free 7-Day Plan is free and has no refund promise.
- The 28-Day Fat Loss Accelerator is `$37` one time, owned for life, and has a seven-day
  refund-request window.
- Purchase creates ownership. It does not start Day 1.
- Starting creates a run. Only one structured program run is active at a time.
- Previous and completed runs remain recorded.
- Day 1 begins when the customer explicitly starts. Missed time does not skip or expire assignments.
- Only the next unfinished required day unlocks.
- Completed 7-Day work remains saved when the customer buys or starts the Accelerator.
- Nutrition unlocks from qualifying paid ownership and never blocks workout progress.
- Recovery links remain portable and reusable while valid. A newer request does not revoke an older
  valid link. Intentional plan replacement is the revocation boundary.
- Same-browser unfinished assessment answers may resume. Another browser returns to Welcome and
  Step 1. Completed plans require secure access plus explicit restart.
- Permanent member navigation is Home, Programs, Progress, and Nutrition. Account and Notifications
  remain persistent utilities.
- App-wide background, typography, buttons, spacing, navigation, and component decisions apply
  across routes rather than being reinvented page by page.

## Known release work still open

- Reconcile `main` and `release/v1.1` without rewriting history.
- Decide the long-term single development baseline and GitHub default branch.
- Verify final Accelerator media, program-content readiness, and remaining launch requirements.
- Complete staging and full paid-customer journey verification before live payments or public paid
  enrollment.
- Reconcile the review catalog with real live components so review scenarios cannot silently drift.
- Resolve the production email-origin decision preserved in PR #35 against current source.
- Review the exact branch-retirement list and create archival references before any branch deletion
  or stale-PR closure.

## Active checkpoint

The active checkpoint is documentation authority cleanup only. It restores missing release
evidence, separates current contracts from historical checkpoints, and records exact retirement
candidates. It must not change app behavior, database state, providers, email gates, payment gates,
public intake, production, branches, or pull-request state.

## Updating this file

Update this file in the same pull request whenever a change alters implemented scope, active gates,
the governing branch, deployment identity, or the next approved checkpoint. Record immutable SHAs
as audited checkpoints, not as a claim that a mutable branch will remain at that SHA. Do not append
historical narrative. Move completed evidence into `docs/release-evidence/` or `docs/history/`.
