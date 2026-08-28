# V1.1 28-Day Paid Enrollment and Progress Foundation

## Checkpoint outcome

This checkpoint adds the private database-backed foundation for the 28-Day Fat Loss Accelerator.
It does not open enrollment or connect money, video, email, or marketing providers.

## Paid-domain records

The paid program is intentionally separate from the free plan's `lead_plans` lifecycle:

- `paid_customers` - normalized customer identity
- `paid_purchases` - one verified purchase record with a seven-day refund-request deadline
- `paid_product_entitlements` - the customer's active or revoked right to the product
- `paid_program_enrollments` - one exact program version and immutable content snapshot
- `paid_program_access_sessions` - hashed opaque access credentials only
- `paid_program_day_completions` - one saved completion per enrollment day
- `paid_program_weekly_check_ins` - one saved weight, waist, and optional note per week

All tables use row-level security and are restricted to the service role. The browser never reads or
writes the paid tables directly.

## Trusted enrollment boundary

`provision_accelerator_enrollment` is a service-role-only transaction for a future trusted checkout
adapter. It accepts only the locked `$37 USD`, `accelerator_28`, and `accelerator_28_v1` values. It
creates the purchase, entitlement, enrollment, version snapshot, and hashed access session in one
transaction.

The transaction is idempotent by purchase key and request fingerprint. An exact retry returns the
existing enrollment. Reusing the key or provider reference with different details returns a
conflict. No route currently invokes this transaction.

## Saved progress and resume behavior

The private `/accelerator` route reads a separate paid-program credential from the browser and sends
it to server functions. The server hashes the credential, verifies the active entitlement and
enrollment, and returns only the authorized version snapshot, completions, and check-ins.

Day completion is atomic and server-enforced:

- The requested enrollment and program version must match.
- Every earlier day must already be complete.
- An exact repeated completion is successful without creating a duplicate.
- Day 28 marks the enrollment complete.
- No calendar date advances, skips, or expires a day.

Because progress is loaded from the database each time, leaving and returning resumes the earliest
incomplete day.

## Weekly check-ins

Each week stores weight, waist, and optional progress notes. Week 1 is available at enrollment.
Weeks 2 through 4 unlock only after the previous seven-day block is complete. Re-saving a week
updates that week's record instead of creating a duplicate.

The first private UI uses pounds and inches. The database and server contract also support kilograms
and centimeters for a later UI choice.

## Still closed and inactive

- Public enrollment and navigation
- Checkout and payment-provider calls
- Live customer migration
- Paid-program recovery and email delivery
- Transactional or marketing email activation
- Real Cloudflare Stream IDs
- Four verified weekly coaching videos
- Calorie or protein formulas
- Public runtime or equipment claims
- McLovable publishing

The existing `/preview/accelerator` route remains a local-only layout simulator. The new
`/accelerator` route is private, unlinked, and marked `noindex, nofollow`.
