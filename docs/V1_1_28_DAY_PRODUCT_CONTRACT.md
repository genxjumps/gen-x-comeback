# V1.1 28-Day Fat Loss Accelerator Product Contract

## Checkpoint scope

This document is the current source of truth for the paid-program foundation. This checkpoint
defines the product and its deterministic schedule. It does not add checkout, enrollment, paid
access, public sales-page routes, or live provider calls.

## Locked offer

- Product code: `accelerator_28`
- Initial program version: `accelerator_28_v1`
- Price: $37 USD one time
- No subscription or recurring charge
- Seven-day refund-request window after purchase
- Self-guided in-app delivery - not live or one-on-one coaching
- Future improvements are limited to this same 28-Day Fat Loss Accelerator
- The active program does not expire while the customer is completing it

## Locked program sequence

The program contains four completion-based weeks. Calendar time does not move a participant
forward, skip a missed day, or expire an assignment.

| Program day | Assignment        | Advancement rule                                  |
| ----------- | ----------------- | ------------------------------------------------- |
| 1           | Workout A         | Complete the assigned day                         |
| 2           | Workout B         | Complete the assigned day                         |
| 3           | Workout C         | Complete the assigned day                         |
| 4           | Workout D         | Complete the assigned day                         |
| 5           | Workout E         | Complete the assigned day                         |
| 6           | Active Recovery F | Video is optional; day acknowledgment is required |
| 7           | Rest              | Rest-day acknowledgment is required               |

The same seven-day sequence repeats for Weeks 2 through 4. Repetition is an intentional part of
the product - the participant improves execution, pace, control, capacity, and consistency rather
than receiving 28 unrelated workouts.

The weekly coaching focus is:

1. Set Your Baseline
2. Clean It Up
3. Raise Your Output
4. Finish Strong

Only the current incomplete day is actionable. Completed days remain visible, and future days stay
locked. If life interrupts the participant, they resume the same next day when they return.

## Delivery boundaries

- The paid program receives its own product, purchase, entitlement, enrollment, progress, access,
  and paid-email domain. It must not be forced into the free plan's `lead_plans` lifecycle.
- Reuse security patterns that already work - normalized email, hashed opaque access credentials,
  non-enumerating recovery, idempotent writes, and server-enforced sequential completion.
- Activating an enrollment snapshots the program version so later content changes cannot silently
  rewrite an active participant's assignment history.
- Initial paid email scope is purchase/access delivery and user-requested recovery only.
- Public entry points remain unavailable until the launch requirements below are verified.

## Launch requirements

All requirements start as unverified. A future checkpoint must attach concrete evidence before
public enrollment can be enabled.

| Requirement                        | Current state | Evidence needed                                           |
| ---------------------------------- | ------------- | --------------------------------------------------------- |
| Workouts A-E and Active Recovery F | Unverified    | Correct files present, ordered, and playable              |
| Workout runtimes                   | Unverified    | Final encoded A-E runtimes support the public time claim  |
| Equipment                          | Unverified    | A-F audit supports rope/bodyweight/no-gym claims          |
| Weekly coaching                    | Unverified    | Four finished coaching primers placed in the program      |
| Nutrition targets                  | Unverified    | Approved calorie and protein logic implemented and tested |
| Checkout handoff                   | Unverified    | $37 test purchase creates the intended paid access        |
| Refund path                        | Unverified    | Seven-day request path and policy are operational         |
| Resume behavior                    | Unverified    | Missed days do not expire, forfeit, or auto-skip          |

## Claims that must stay unpublished until verified

- Exact workout runtimes
- Final equipment requirements
- Availability of four weekly coaching videos
- Availability or formula of `Your Nutrition Targets`
- Working purchase-to-app access
- Working refund handling
- Public enrollment availability

Do not add fake pricing, discounts, scarcity, countdowns, testimonials, transformations, guaranteed
results, live-coaching claims, or guaranteed direct access to Todd.

## Explicitly outside this checkpoint

- Visual redesign
- Sales-page implementation
- Stripe or another payment provider
- Database migrations
- Paid access links or recovery
- Email delivery
- Nutrition formulas
- Video URLs, titles, runtimes, or equipment claims that have not been audited
- Public intake or paid enrollment activation
