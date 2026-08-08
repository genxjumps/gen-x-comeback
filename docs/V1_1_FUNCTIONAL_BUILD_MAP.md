# V1.1 Functional Build Map

- Status: proposed implementation contract for review
- Created: 2026-08-08
- Target: `release/v1.1`
- Scope of this checkpoint: documentation only

## Outcome

Build the paid 28-Day Fat Loss Accelerator without destabilizing the working free 7-Day Plan. The fastest safe path is a separate paid-program domain that reuses proven access and completion patterns, not the free plan's tables, hard-coded day model, or email lifecycle.

No design refresh is part of V1.1. Existing production behavior remains unchanged until the entire paid path passes in isolated staging and the bridge is explicitly enabled.

## Source reconciliation

The app's accepted Product Blueprint and Decision Log contain the original paid-product direction: a $17 offer reached after the free plan. The later 28-day website records contain Todd's current decisions and supersede that older paid-product detail while leaving the accepted free 7-day experience intact.

| Area           | Current 28-day direction                                                       | Older app record                              |
| -------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| Price          | $37 one-time, with no manufactured discount                                    | $17                                           |
| Entry          | Free 7-day path remains primary, but direct purchase is allowed                | Post-free-plan bridge only                    |
| Delivery       | The app is the product experience; PDFs are conveniences                       | Paid app delivery planned but under-specified |
| Progression    | Completion-based, no calendar expiration, resume the assigned day              | Not defined                                   |
| Training       | A-E plus Active Recovery F, repeated for four weeks, with a rest day each week | Existing 28-day videos noted but not mapped   |
| Coaching       | Four evergreen weekly coaching videos are core content                         | Not defined                                   |
| Support        | Self-guided and personally led, without coaching or guaranteed personal access | Not defined                                   |
| Guarantee      | Seven-day refund window                                                        | Not defined                                   |
| Ongoing access | Lifetime updates to this same product                                          | Not defined                                   |

Before feature code merges, the accepted app Product Blueprint, Technical Specification, and Decision Log must be reconciled with these current paid-product decisions. That documentation PR must not rewrite or reopen settled free-plan decisions.

Primary records:

- [App Product Blueprint](https://docs.google.com/document/d/1SCLkVb8lI7i9asO1vUncgrIGxiLKqNvnDBr9FJE2yRI)
- [App Technical Specification](https://docs.google.com/document/d/1PysQS7czXEADzAOGubbmp6dBEnNs5I2FWntgPO1zplw)
- [App Decision Log](https://docs.google.com/document/d/1EACwjKukFY7DxOM6ifyJolXm_e6WLtNhdXxZQ1y0ZZA)
- [Current 28-day Decision Log](https://docs.google.com/document/d/1Yv_5Pxk3inOKSWRFUSHwY8YNnGtDoitOOse7LZzxL3I)
- [Current Product Truth and Content Briefs](https://docs.google.com/document/d/1Jdego2tYRP-AmSxQisH2-ec-yphh92DTQ6AVHfcl-cg)
- [Current Website Technical Record](https://docs.google.com/document/d/1V27b8IRj-Rm_NyqBAj7iYPkGxBlfW573f9QOBRFDyfI)
- [28-day Program Calendar](https://drive.google.com/file/d/1ioY4kkyHQewVHIabvdSa4VZI8P2hfoxA)

## Functional contract

### Purchase and entitlement

- Product code: `accelerator_28`.
- Price: $37 USD, one-time.
- Hosted Stripe Checkout is the proposed payment surface. Do not build a custom card form.
- A verified completed payment creates a durable product entitlement.
- Checkout return and Stripe webhook processing call the same idempotent fulfillment service. The webhook remains the durable source of truth.
- A full refund within the seven-day policy revokes the entitlement. Launch support may process the refund in Stripe; no customer-facing refund console is required.
- Duplicate, delayed, and out-of-order provider events must not create duplicate purchases, entitlements, enrollments, or emails.

### Access

- Use normalized email plus short-lived opaque access links and server-managed sessions, following the proven free-plan security pattern in a separate paid namespace.
- Do not add passwords, social login, or a general account system in V1.1.
- A successful checkout can establish immediate access after server-side verification. A purchase/access email provides the durable return path.
- Recovery accepts an eligible purchaser's email without revealing whether an entitlement exists.
- Revoked or refunded access fails closed.

### Program progression

- `Get Started` activates Day 1. Purchase time alone does not start or expire the program.
- Only the current assigned day is actionable. Completing it advances the enrollment exactly once.
- The 28-day roadmap may be visible, but future content remains locked.
- Missing calendar days never skips, expires, or advances an assignment.
- Days 1-7 repeat for four weeks:
  - Day 1: Workout A
  - Day 2: Workout B
  - Day 3: Workout C
  - Day 4: Workout D
  - Day 5: Workout E
  - Day 6: Active Recovery F
  - Day 7: Rest
- Proposed Day 6 rule: the recovery day must be acknowledged to preserve sequential progression, but doing the Active Recovery F video is optional. Day 7 is likewise acknowledged as a completed rest day.
- Day completion is idempotent and safe across refreshes, retries, tabs, and repeated requests.
- Completing Day 28 marks the enrollment complete. Proposed post-completion behavior is an open purchased library for the completed program version.

### Content and nutrition

- Workouts A-F require a verified hosted URL, duration, equipment list, title, and approved supporting copy before launch.
- One evergreen coaching video is associated with each program week. All four are required launch content, not artificial bonuses.
- `Your Nutrition Targets` is required at launch. Its input set, formulas, unit handling, bounds, disclaimers, and tests need a dedicated evidence-backed contract before implementation.
- Practical nutrition guidance centers on repeatable meals, a protein anchor, appropriate carbohydrate and fat intake, environment control, returning to defaults after a miss, and adjusting from trends.
- Optional Day 1 and Day 28 weight, waist, and text reflection may be included after the core path is green. Photo upload and any public-use workflow are out of the critical path.

### Communication and analytics

- Required paid email scope is purchase/access delivery plus requested recovery.
- A proactive paid lifecycle is deferred until the paid experience itself passes, matching the accepted app sequence.
- Required events include checkout started, purchase completed, access established, program activated, day completed, program completed, recovery requested, refund completed, and bridge conversion.
- Analytics payloads must exclude access tokens and unnecessary personal data.

## Architecture boundary

The free 7-day implementation is intentionally specialized: `lead_plans` stores a current seven-day plan snapshot, routes cap plan days at seven, completion logic contains seven-day lifecycle behavior, and email jobs are coupled to that plan. Stretching these records to 28 days would make every existing lifecycle path riskier and would blur lead access with paid ownership.

Reuse these proven patterns:

- normalized email handling;
- hashed opaque tokens and server sessions;
- recovery responses that prevent account enumeration;
- idempotent completion writes;
- database-generated types and RLS review;
- scheduler and email delivery test conventions;
- event naming and no-PII analytics rules.

Do not reuse or generalize these free-plan structures in the first paid release:

- `lead_plans` or its assessment/plan JSON as paid enrollment state;
- free plan start/completion rows;
- the seven-assignment constant or day-bounded plan route;
- free lifecycle job types, halfway/stalled rules, or consent assumptions;
- reassessment behavior as a paid-program restart mechanism.

### Proposed paid domain

Exact DDL belongs in the schema checkpoint. The intended ownership boundary is:

| Record                                                | Responsibility                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `products`                                            | Stable product code and availability controls                           |
| `customers`                                           | Canonical normalized purchaser identity                                 |
| `purchases`                                           | Provider transaction, amount, currency, and payment/refund state        |
| `payment_provider_events`                             | Unique provider event IDs and idempotent processing evidence            |
| `entitlements`                                        | Durable right to access a product, independent of one enrollment        |
| `program_enrollments`                                 | Activation, program version snapshot, current day, and completion state |
| `program_day_completions`                             | One idempotent completion per enrollment day                            |
| `program_access_tokens` and `program_access_sessions` | Paid access and recovery security boundary                              |
| `program_email_jobs`                                  | Paid purchase/access and recovery delivery without touching free jobs   |

Program structure belongs in a versioned, typed manifest rather than 28 copied database rows. Activation snapshots the program version onto the enrollment. Existing enrollments remain pinned to their activated version, while the product-level entitlement preserves access to approved future updates.

All initial schema work should be additive. Availability controls keep direct-purchase and free-plan bridge entry points hidden until the whole path passes. A failed release can be disabled without mutating free-plan data; database corrections remain forward-only.

## Isolated staging requirement

Lovable preview is not database isolation: preview and published versions of the current project use the same backend and data. No V1.1 schema, payment, email, scheduler, or mutable program test may use that preview as staging.

Before the first migration:

1. Provision an independent staging backend with separate URL, keys, secrets, email recipients, Stripe test credentials, and data.
2. Prefer a dedicated Supabase staging project because the repository already uses standard Supabase migrations and environment-driven clients. This does not require moving production off Lovable Cloud.
3. If provisioning blocks the checkpoint, evaluate a Lovable Cloud remix strictly as an independent backend. Do not edit source in the remix, and use it only if migration replay and stable environment separation are demonstrable.
4. Replay all existing migrations from empty state, regenerate types, seed synthetic records, and run the complete current test suite.
5. Add an unmistakable staging marker and fail closed when production and test provider credentials are mixed.
6. Never copy production plans, tokens, sessions, customer data, provider events, secrets, or email state into staging.

The staging checkpoint is complete only when a fresh environment can be recreated from the repository plus documented secrets, not from manual database edits.

## Checkpoint sequence

Each row is one bounded pull request into `release/v1.1`. Targeted tests run while building; `bun run verify` and one complete diff review run before every PR.

| #   | Checkpoint                                  | Completion gate                                                                                                                                                                                        |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Reconcile paid-product source records       | App Blueprint, Technical Specification, and Decision Log reflect the current $37, direct-entry, delivery, progression, support, refund, and lifetime-update decisions without altering free-plan truth |
| 2   | Establish isolated staging                  | Clean migration replay, synthetic seed, environment separation, provider test safeguards, and current suite pass without production access                                                             |
| 3   | Lock program and asset contract             | Typed/versioned 28-day manifest passes schedule/state tests; A-F and four weekly video inventory identifies every real asset gap                                                                       |
| 4   | Add paid-domain schema                      | Additive tables, constraints, RLS, generated types, idempotency rules, seeds, and migration tests pass in staging                                                                                      |
| 5   | Build access and progression                | Synthetic entitlement reaches Get Started, Day 1 through Day 28, resume/recovery, completion, and post-completion access with all lock rules enforced                                                  |
| 6   | Add weekly coaching and nutrition           | Four verified weekly assets render in the right weeks; approved nutrition-target contract and guidance pass unit, bounds, and error tests                                                              |
| 7   | Integrate Stripe and paid email             | Test checkout, immediate verified return, webhook fulfillment, access email, recovery, duplicate events, failed payment, and full refund pass                                                          |
| 8   | Connect bridge, direct entry, and analytics | Both entry paths work behind availability controls; required events fire once; complete staging journey and failure matrix pass                                                                        |
| 9   | Release candidate                           | Full `main...release/v1.1` diff, CI, documentation, migration plan, staging evidence, controlled Lovable preview, and explicit publish approval are complete                                           |

## End-to-end acceptance matrix

The release cannot expose a purchase CTA until all of these pass in isolated staging:

- A direct buyer completes test checkout, receives one entitlement, gets immediate access, receives the access email, activates Day 1, and can recover later.
- A free-plan user follows the bridge into the same checkout and receives the same product entitlement without modifying their free-plan state.
- Refresh, repeated completion, multiple tabs, and retry after a network failure never advance more than one day.
- A user cannot open a future day by changing a URL, request body, local state, or stale link.
- A user can pause for any length of time and resumes the same assigned day.
- The four weekly coaching items appear in their correct weeks and all required training assets are playable with usable failure states.
- Day 28 completes once, records the event once, and opens the completed purchased library as specified.
- Duplicate and reordered Stripe events remain idempotent. Failed or abandoned checkout grants nothing.
- Full refund revokes access and records the refund without deleting audit evidence.
- Recovery and unauthorized-access responses do not reveal purchaser status.
- Email test mode cannot send to an unapproved external address.
- The existing free 7-day lifecycle, scheduler, recovery, consent, and 472-test baseline remain green.
- Production schema, data, secrets, provider state, email state, and Lovable publication remain untouched during development.

## Explicit exclusions

- visual redesign or polish work;
- subscriptions, installments, coupons, or a manufactured sale price;
- passwords, social login, or a general customer account center;
- private community, live coaching, personal reviews, or guaranteed direct support;
- heavy scorecards, repeated workout benchmarking, leaderboards, or streak pressure;
- automatic testimonial, photo, or transformation publishing;
- self-service refund administration or a custom internal admin dashboard;
- concurrent enrollments, customer-triggered restarts, or multiple program products;
- proactive paid email campaigns beyond purchase/access and requested recovery;
- embedded checkout or custom payment fields.

## Speed controls

- Keep every checkpoint narrow and preserve the free-plan data model.
- Build the pure program manifest and progression state machine before provider integration.
- Use deterministic synthetic fixtures and a fake payment adapter until the Stripe checkpoint.
- Put all new entry points behind server-checked availability controls.
- Run focused tests during iteration, then one complete local quality gate and one complete diff review per PR.
- Avoid incidental refactors, dependency upgrades, and abstractions for hypothetical future products.
- Treat content inventory and nutrition research as explicit dependencies early so they cannot surprise the release candidate.
- Keep visual work frozen until Todd explicitly reopens it.

## Decisions and dependencies to close

One bundled approval can close the remaining architecture defaults:

1. Use hosted Stripe Checkout and webhook-based fulfillment.
2. Use separate passwordless paid access built from the proven opaque-token/session pattern, not a new account UI.
3. Require acknowledgment of Day 6 and Day 7 to advance, while the Active Recovery F workout itself remains optional.
4. Open the purchased program library after Day 28 while keeping future days locked during the active run.

The following are delivery dependencies, not reasons to redesign the architecture:

- verified hosted asset records for Workouts A-F;
- creation and hosting of four weekly coaching videos if final assets do not yet exist;
- an approved nutrition-target input/formula/guardrail contract;
- staging backend credentials;
- Stripe test credentials and webhook endpoint configuration;
- approved sender identity and staging email allowlist.
