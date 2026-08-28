# V1.1 Accelerator Implementation Plan

## Purpose and authority

This plan turns the approved Accelerator product requirements into a dependency-based implementation
sequence. The canonical product requirements remain
[`V1_1_28_DAY_PRODUCT_CONTRACT.md`](V1_1_28_DAY_PRODUCT_CONTRACT.md). This document governs build
order and checkpoint boundaries; it does not replace the product contract.

Update this plan only when a material product, architecture, schema, integration, release-boundary,
or checkpoint-order decision changes. Routine implementation progress belongs in code, tests, pull
requests, and Git history.

## Current foundation verdict

PR #16 is useful source evidence, but it is not the accepted final Accelerator architecture. Its
migration remains unapplied and must not be applied before reconciliation.

### Reuse

- The locked `$37 USD` one-time offer and seven-day refund-request window.
- The approved 28-day sequence and versioned program-snapshot pattern.
- Separate purchase and product-entitlement concepts.
- Idempotent trusted provisioning and conflict detection.
- Hashed opaque credentials and server-side authorization patterns.
- Service-role-only writes, row-level security, and fail-closed public enrollment.
- Atomic sequential completion as a starting pattern.
- Existing Supabase passwordless-auth client and middleware groundwork.
- Existing scanner-safe return, recovery, email scheduling, consent, and delivery safeguards.

### Reconciled through Checkpoint 3

- Purchase grants Not Started ownership without starting a run.
- One entitlement supports repeatable, versioned runs and preserved history.
- Free and paid ownership resolve through one verified customer account.
- Not Started, Active, Paused, Completed, and Revoked states are represented.
- One active structured-program pointer coordinates linked 7-Day Plans and paid runs.
- Customer-local next-day unlocking, missed-day persistence, latest-completion Undo, completed-day
  reopening, and separate video-view facts are represented and tested.

### Reconcile or replace next

- Weekly check-ins require both measurements, overwrite one weekly row, and cannot preserve the
  approved detailed history.
- The current private Accelerator page is a proof screen, not the approved platform navigation or
  customer experience.

### Still required

- Measurement, reminder, and preference models.
- Home, My Programs, Daily Assignment, Your Progress, Your Nutrition, Explore Programs, and the
  notification inbox.
- Customer-facing setup, pause, resume, switching, repeat runs, previous-run history, and Day 28
  completion screens.
- Real program media, runtime, equipment, instructions, coaching, and orientation content.
- Approved nutrition guidance and deliberately reviewed target formulas.
- Todd's private customer-progress view.
- Test-mode checkout, verified purchase handoff, access delivery, recovery, and refund handling.
- Integrated release verification and controlled publication.

## Dependency-based checkpoints

Each checkpoint is one bounded branch and pull request unless a real implementation dependency
requires Todd to approve a change in sequence.

| #   | Checkpoint                          | Bounded outcome                                                                                                                                                                                   | Depends on |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 0   | Canonical baseline                  | Merge the approved product contract, complete the read-only PR #16 gap audit, and lock this implementation plan.                                                                                  | None       |
| 1   | Unified customer account            | Establish one verified passwordless customer identity that can own free and paid programs across supported devices.                                                                               | 0          |
| 2   | Ownership and program runs          | Separate purchase, entitlement, program start, and individual runs; support Not Started, Active, Paused, Completed, repeat runs, version history, and one active structured program.              | 1          |
| 3   | Program progress engine             | Implement start, pause, resume, switching, customer-local next-day unlocking, missed-day persistence, completion, latest-completion undo, completed-day reopening, and separate video-view facts. | 2          |
| 4   | Measurement history                 | Support independent optional weight and waist entries, additions, corrections, removals, global latest values, and run-specific starting, newest, and final values.                               | 2-3        |
| 5   | Program content readiness           | Audit Workouts A-F, runtime, equipment, orientation, daily instructions, weekly coaching, and Cloudflare media; produce the complete V1 program snapshot.                                         | 2          |
| 6   | Nutrition approval                  | Finish Protein First content and deliberately approve any calorie or protein logic before it becomes product behavior.                                                                            | 0          |
| 7   | Platform shell                      | Build the authenticated app structure and functional navigation for Home, My Programs, Your Progress, Your Nutrition, Explore Programs, and notifications.                                        | 1-3        |
| 8   | My Programs and setup               | Build customer-facing program states, previous runs, completed 7-Day access, Accelerator orientation, optional starting measurements, explicit starting, and safe switching warnings.             | 2-5, 7     |
| 9   | Daily Assignment                    | Deliver the current assignment, program schedule, locked previews, real video, practical instructions, rest and recovery handling, completion, undo, and missed-day messaging.                    | 3, 5, 7-8  |
| 10  | Progress, nutrition, and completion | Build simple progress views, detailed history, Your Nutrition, optional Day 28 measurements, completion summary, repeat-program action, and other-program recommendations.                        | 4, 6, 8-9  |
| 11  | Engagement and private admin        | Add in-app reminders, measurement-reminder dismissal, reminder preferences, the four-day and ten-day platform comeback sequence, and Todd's private customer-progress view.                       | 3-4, 7-10  |
| 12  | Commerce and access delivery        | Connect test-mode checkout, verified purchase handoff, durable ownership, backup access email, customer recovery, and refund-request handling.                                                    | 1-3, 8-11  |
| 13  | Release hardening                   | Run end-to-end verification, complete the functional-first visual pass, decide the production backend boundary, verify every launch gate, and prepare controlled publication.                     | 1-12       |

## Checkpoint 1: unified customer-account foundation

### Outcome

Create the source-level account and authorization foundation that every later program, screen, and
purchase can safely use.

### Acceptance criteria

- One verified Supabase Auth user maps to one Gen X Jumps customer account.
- The same authenticated identity works across supported devices.
- The account model can link the existing free 7-Day Plan and future paid entitlements without
  forcing either into the other's lifecycle.
- Linking by email requires verified identity and does not expose account existence.
- Program access consent and marketing consent remain separate from account identity.
- Server-side authorization derives the customer from authenticated claims, not a paid-program
  browser token.
- The existing free-plan return and recovery behavior remains functional until a later approved
  transition replaces it.
- The unapplied Accelerator migration is not applied during this checkpoint.
- Focused tests cover identity mapping, replay/idempotency, unauthorized access, and consent
  separation.
- `bun run verify` and the GitHub Quality Gate pass.

### Explicit exclusions

- Home, My Programs, Daily Assignment, or visual redesign.
- Program-run lifecycle implementation.
- Measurement history.
- Public sign-in or enrollment activation.
- Real authentication, recovery, marketing, or program email sends.
- Checkout or payment-provider calls.
- Applying a database migration.
- Customer migration.
- McLovable review or publication.

## Checkpoint 2: ownership and program runs

### Outcome

Separate verified purchase, permanent ownership, explicit program start, and repeatable historical
runs under the unified customer account.

### Acceptance criteria

- A verified purchase records the locked offer and grants durable ownership without starting Day 1.
- Ownership with no run produces the customer-facing Not Started state.
- Starting creates a versioned run with an immutable content snapshot.
- Only one structured run per customer account may be active.
- Starting or resuming another run atomically pauses the active run without resetting progress.
- A paused run is resumed rather than replaced.
- Completing and repeating a purchased program creates a new numbered run without another purchase.
- Previous runs preserve their version, snapshot, timestamps, and history.
- Purchase recording is idempotent and conflict-aware.
- Paid access derives from the unified verified account rather than a paid-only identity or browser
  credential.
- Every table and lifecycle transaction remains service-role only.
- Both migrations remain unapplied.

### Explicit exclusions

- Program-day unlocking, missed-day, undo, completed-day reopening, or video-view behavior.
- Measurement-history correction.
- Customer-facing Home, My Programs, setup, or Daily Assignment screens.
- Checkout, payment-provider, refund, recovery, or email activation.
- Applying a migration or migrating a customer.
- Visual redesign, McLovable review, or publication.

## Drift control

Only the active checkpoint may change source. A new idea is handled in one of three ways:

1. Add it to the active checkpoint only when it is required for the approved acceptance criteria.
2. Stop and re-sequence only when it is a genuine prerequisite or changes approved product behavior.
3. Put it in the later-checkpoint parking lot when it is useful but not required now.

Do not interrupt a checkpoint for unrelated visual polish, provider setup, future membership work,
community features, analytics expansion, or speculative infrastructure.

## GitHub and Actions discipline

GitHub remains authoritative, but Actions usage must be deliberate.

- Work and run the complete quality gate locally before pushing.
- Finish the bounded checkpoint before opening its pull request.
- Batch necessary corrections instead of making repeated small pushes.
- Keep governing documentation with the implementation it governs.
- Do not create a separate documentation pull request when the material can safely travel with the
  next implementation checkpoint.
- Do not rerun a passing workflow without a concrete reason.
- Tell Todd before an action that is expected to trigger a GitHub Quality Gate run and explain why
  that run is necessary.
- Keep the post-merge integration run because it verifies the actual `release/v1.1` state.

## Required checkpoint loop

1. Confirm the current `release/v1.1` SHA and create one local `agent/<checkpoint>` branch.
2. Lock outcome, acceptance criteria, exclusions, and affected documentation.
3. Implement and test locally without invoking McLovable.
4. Run `bun install --frozen-lockfile` and `bun run verify` locally.
5. Review the complete diff and remove unrelated changes.
6. Push the completed checkpoint once and open one pull request into `release/v1.1`.
7. Review the GitHub Quality Gate result.
8. Merge only after Todd approves the completed checkpoint.
9. Verify the post-merge integration run before starting the next checkpoint.
