# V1.1 28-Day Data Foundation

## Current status

The customer-account, purchase, entitlement, and program-run source foundation is reconciled with
the approved product contract. Both Accelerator migrations remain unapplied. Do not apply them
until a later checkpoint deliberately verifies the complete corrected migration chain inside the
approved development boundary.

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
- `paid_program_day_completions` - existing sequential progress scaffolding that Checkpoint 3 will
  reconcile.
- `paid_program_weekly_check_ins` - temporary proof scaffolding that Checkpoint 4 will replace with
  approved measurement history.

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

The generic run model is ready to represent free and paid programs. Checkpoint 3 must connect the
existing 7-Day Plan progress lifecycle to this one-active-program rule before switching behavior is
considered complete.

## Authorization and security

- Customer access derives from the verified unified account.
- A separate paid-program browser credential is no longer authorization.
- All tables use row-level security and are restricted to the service role.
- Every ownership and run-lifecycle transaction is service-role only.
- The browser never reads or writes these tables directly.

## Remaining reconciliation

Checkpoint 3 must replace the existing progress proof with the approved behavior for:

- Customer-local next-calendar-day unlocking.
- Missed days that preserve the current assignment.
- Latest-completion undo.
- Reopening completed days without changing progress.
- Separate video-view and day-completion facts.
- Safe switching with the existing 7-Day Plan.

Checkpoint 4 must replace weekly combined check-ins with independent optional weight and waist
history, corrections, removals, and run-specific starting, newest, and final values.

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
