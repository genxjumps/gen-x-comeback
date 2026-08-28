# V1.1 28-Day Data Foundation

## Current status

The customer-account, purchase, entitlement, program-run, program-progress, and measurement-history
source foundation is reconciled with the approved product contract through Checkpoint 4. Both
Accelerator migrations remain unapplied. Do not apply them until a later checkpoint deliberately
verifies the complete corrected migration chain inside the approved development boundary.

No public enrollment, checkout, payment-provider call, customer migration, email activation,
McLovable publication, or browser write is opened by this foundation.

## Unified customer identity

The earlier customer-account migration establishes:

- One customer account per provider-verified Supabase Auth user.
- One normalized verified email per account.
- Safe legacy 7-Day Plan links without changing plan or consent state.
- Service-role-only, idempotent account resolution.

Paid access now uses that customer account. The former separate `paid_customers` identity and
paid-program browser-token tables have been removed from the unapplied Accelerator migration.

## Purchase and permanent ownership

The account-owned records are:

- `paid_purchases` - independently verified purchase facts and the seven-day refund-request
  deadline.
- `paid_product_entitlements` - the customer's durable right to use the purchased product.
- `paid_program_enrollments` - repeatable, versioned program runs. The historical table name is
  retained, but each row now represents one run rather than ownership.
- `paid_program_day_completions` - sequential completion facts with a bounded latest-completion
  undo window.
- `paid_program_video_views` - video-view facts that remain independent from day completion.
- `customer_active_programs` - the single active structured-program pointer across linked 7-Day
  Plans and paid runs.
- `customer_measurements` - independent active weight or waist entries associated with the overall
  account or one program run.
- `customer_measurement_revisions` - append-only creation, correction, and removal history.

`provision_accelerator_ownership` is a service-role-only transaction for a future trusted checkout
adapter. It accepts only the locked `$37 USD` Accelerator offer and records the purchase plus
entitlement. It deliberately does not create a program run, start Day 1, send access email, or
expose checkout.

The transaction remains idempotent and conflict-aware. An exact retry returns the existing purchase
and entitlement. Reusing an idempotency key or purchase reference with different facts fails
closed.

## Not Started and program runs

Purchase ownership with no program run is the customer-facing **Not Started** state. The customer
must explicitly start the program before Day 1 begins.

`start_program_run_atomic` creates a run only after verifying active ownership. Each run records:

- Its own run number.
- The exact program version.
- An immutable content snapshot.
- Start, pause, completion, and revocation facts.

A completed purchased program can be repeated without another purchase. Each repeat creates the
next run number. Previous runs are never reset or overwritten.

## One active structured program

The database permits only one active program run per customer account. Starting or resuming another
owned program pauses the active run inside the same locked transaction. Pausing preserves the
version, snapshot, progress, and run identity.

The run lifecycle supports:

- Active.
- Paused.
- Completed.
- Revoked.

Not Started remains an ownership state before a run exists. A paused run must be resumed rather
than replaced with a duplicate run.

The active-program pointer can select either a linked unfinished 7-Day Plan or a paid run. Switching
to the 7-Day Plan pauses the active paid run without deleting either program's progress. Starting
or resuming a paid run replaces the 7-Day selection and reports what was displaced so the future UI
can show the approved warning.

## Program progress engine

Each paid run captures a validated IANA customer time zone when the customer explicitly starts it.
The progress transaction uses that fixed run time zone to unlock Days 2 through 28 on the next
customer-local calendar date after the prior completion.

- Only the earliest unfinished day can be completed.
- Missing one or more calendar days leaves that same assignment current and never stacks or skips
  assignments.
- Completed days remain readable without changing progress.
- Completing a day creates a ten-minute Undo window for only that latest completion.
- Day 28 completion closes the run and clears the active pointer. A valid immediate Undo reopens it
  only when no other structured program has become active.
- Video views store first view, latest view, and replay count without completing a day.
- All reads and writes remain server-authorized and service-role only.

The existing live 7-Day completion and lifecycle-email transaction is deliberately unchanged.
Checkpoint 3 adds safe selection and switching around that history but does not replace or activate
the live free-plan path.

## Authorization and security

- Customer access derives from the verified unified account.
- A separate paid-program browser credential is no longer authorization.
- All tables use row-level security and are restricted to the service role.
- Every ownership and run-lifecycle transaction is service-role only.
- The browser never reads or writes these tables directly.

## Measurement history

Checkpoint 4 replaces the combined weekly check-in proof with independent weight and waist
entries. Either kind may be added, corrected, or removed without requiring or changing the other.
Removed values no longer appear in the active customer history, while append-only revisions retain
what was created, corrected, or removed.

The active history supports four deliberately distinct views:

- Latest weight and waist across the customer's whole account.
- Starting weight and waist for one run.
- Newest weight and waist associated with one run.
- Explicit final weight and waist for a completed run.

Starting and final values are limited to one active logical entry per run and measurement kind.
Removing one permits a replacement while retaining the removed entry's revisions. Direct
service-role mutation is revoked; the account-bound add, correct, and remove transactions are the
write boundary.

## Remaining reconciliation

Checkpoint 5 must verify the real program content, media, runtime, equipment, orientation, daily
instructions, and weekly coaching snapshot before customer-facing program work uses it.

## Still closed and inactive

- Applying either unapplied Accelerator migration.
- Public sign-in, enrollment, or paid navigation.
- Checkout and payment-provider calls.
- Live customer migration.
- Paid-program recovery or email delivery.
- Transactional or marketing email activation.
- Real Cloudflare Stream media.
- Calorie or protein formulas.
- McLovable review or publication.

The `/accelerator` proof route remains private, unlinked, and marked `noindex, nofollow`.
