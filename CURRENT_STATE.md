# Gen X Jumps App - Current State

**Role:** Current
**Snapshot date:** September 17, 2026
**Current integration branch:** `release/v1.1`

This is the only repository document allowed to describe what is true **now**. Product contracts
define durable behavior. Runbooks define procedures. Historical checkpoints and release evidence do
not define current status.

## Source and deployment identity

| Surface                       | Revision                                                                                          | Meaning                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Active integration source     | Resolve the live `release/v1.1` ref                                                               | GitHub default and Lovable-connected branch                    |
| Production app identity       | `102a853cb58e1ece6dc518152e305a5590325079`                                                        | Verified live at `app.genxjumps.com` on September 17, 2026     |
| Repository reconciliation     | PR #272, merge `cbfb16360d83d62bc63d42f682e4eaea1d714ce5`                                         | Preserved both histories and matched the release tree          |
| Reconciliation quality gate   | Workflow run [#35221295820](https://github.com/genxjumps/gen-x-comeback/actions/runs/35221295820) | Passed against the reconciled `main` merge                     |
| Preserved historical branch   | `main`                                                                                            | Reconciled record; not a current development or release target |
| Preservation branch           | `archive/pre-reset-2026-09-17` at `9edba783553d87dc0cc76e4aca5774e4e9b63b61`                      | Exact pre-reset recovery point                                 |
| Repository cleanup checkpoint | Workflow run [#35213638821](https://github.com/genxjumps/gen-x-comeback/actions/runs/35213638821) | Retired 257 stale working branches after exact preservation    |

`release/v1.1` is the single active branch for current work. Create bounded task branches from it
and merge them back through pull requests. `main` remains preserved and must not be used as a
second integration line.

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
- Precision Utility production design system with semantic tokens, shared production primitives,
  photo-free branded workout media, and a hidden noindex component showcase.
- Shared legacy UI primitives are being migrated system-first to Precision Utility so button, form,
  page hierarchy, progress, shell, and navigation changes inherit across routes instead of being
  rebuilt page by page.
- A review catalog for controlled visual and copy review.
- Production lifecycle and Recovery email links are pinned to `https://app.genxjumps.com`; staging
  email runtimes remain separately configurable.

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

## Repository cleanup status

- The preservation-first repository reset is complete.
- Exactly 257 stale working branches were retired after a fresh comparison.
- Retained preservation, archive, and superseded task branches remain available. They are not
  active development sources and were not deleted during reconciliation.
- PRs #26, #35, #72, #81, and #90 were closed without merging. PR #35's production email-origin
  safeguard was rebuilt on current source through PR #271.
- Exact retained refs and verification evidence are recorded in
  [the branch-retirement completion](docs/release-evidence/2026-09-17-branch-retirement-completion.md).

## Known release work still open

- Verify final Accelerator media, program-content readiness, and remaining launch requirements.
- Complete staging and full paid-customer journey verification before live payments or public paid
  enrollment.
- Reconcile the review catalog with real live components so review scenarios cannot silently drift.
- Complete Precision Utility migration of genuinely route-specific visual residue after the shared
  primitives are migrated and verified.

## Active checkpoint

Precision Utility shared-primitive migration is the active design checkpoint. The current bounded
checkpoint migrates the shared controls, form controls, page hierarchy, setup progress, persistent
shell/navigation, and global compatibility bridge while preserving route behavior and product
contracts. Route-specific visual cleanup comes only after this shared layer is verified.

## Updating this file

Update this file in the same pull request whenever a change alters implemented scope, active gates,
the governing branch, deployment identity, or the next approved checkpoint. Record immutable SHAs
as audited checkpoints, not as a claim that a mutable branch will remain at that SHA. Do not append
historical narrative. Move completed evidence into `docs/release-evidence/` or `docs/history/`.
