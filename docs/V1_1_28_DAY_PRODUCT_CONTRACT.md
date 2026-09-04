# V1.1 28-Day Fat Loss Accelerator Product Requirements

## Authority and status

This document is the canonical product source of truth for the Gen X Jumps app experience that
supports the 28-Day Fat Loss Accelerator.

The requirements below were approved during product planning on August 28, 2026. They supersede
the narrower product assumptions that existed when the first private enrollment and progress
foundation was built.

These are approved product requirements, not a claim that the current code or unapplied migration
already supports every behavior. Before implementation continues, the repository, tests, and
unapplied migration must be audited against this document. See
[`V1_1_28_DAY_DATA_FOUNDATION.md`](V1_1_28_DAY_DATA_FOUNDATION.md).

Public enrollment remains closed. This document does not authorize checkout, real payment calls,
public publishing, customer migration, production Accelerator email, or applying the current
Accelerator migration.

## Platform north star

Gen X Jumps is becoming a structured fitness platform that can eventually replace Uscreen for
Todd's business. It is not becoming a Netflix-style video library.

The platform should help customers:

- Find and buy fitness programs.
- Know exactly what to do today.
- Complete programs.
- Track meaningful fitness progress.
- Resume after interruptions without shame or unnecessary restarting.
- Use practical nutrition guidance and tools.
- Move from one program into another and, later, into membership.
- Stay engaged long enough to get results.
- Give Todd enough visibility to see where customers start, succeed, struggle, pause, or stop.

Structured fitness programs remain the center. Membership, community, live workouts, challenges,
quick workouts, messaging, coaching, badges, and broader retention tools may be added later without
taking over the core program experience.

## Release boundary

The Accelerator launch is a functional product release inside one integrated Gen X Jumps PWA.

Launch requirements include:

- One customer account across supported devices.
- Passwordless access by secure email link or code.
- Immediate access after a verified purchase plus a backup access email.
- Individual program ownership with future membership compatibility.
- One primary active structured program at a time.
- A focused daily assignment experience.
- Saved program runs, completion history, optional measurements, and resume behavior.
- A simple private progress view for Todd.

On-demand workouts remain separate. Watching or completing an on-demand workout does not advance a
structured program. Approved 10-minute program substitutes are a future improvement and are not
part of the Accelerator launch.

## Locked offer

- Product name: 28-Day Fat Loss Accelerator
- Product code: `accelerator_28`
- Initial program version: `accelerator_28_v1`
- Price: $37 USD one time
- No subscription or recurring charge
- Seven-day refund-request window after purchase
- Self-guided in-app delivery, not live or one-on-one coaching
- Purchased access does not expire
- Completing the free 7-Day Comeback Plan is not required
- Anyone may buy the Accelerator directly when public enrollment is eventually opened

Purchase grants ownership but does not start Day 1. A new purchase appears in My Programs as
**Not Started** until the customer explicitly starts it.

## Locked program sequence

The program contains four completion-based weeks. A missed day does not move the participant
forward, skip an assignment, or expire access.

| Program day | Assignment        | Advancement rule                                  |
| ----------- | ----------------- | ------------------------------------------------- |
| 1           | Workout A         | Complete the assigned day                         |
| 2           | Workout B         | Complete the assigned day                         |
| 3           | Workout C         | Complete the assigned day                         |
| 4           | Workout D         | Complete the assigned day                         |
| 5           | Workout E         | Complete the assigned day                         |
| 6           | Active Recovery F | Video is optional; day acknowledgment is required |
| 7           | Rest              | Rest-day acknowledgment is required               |

The same seven-day sequence repeats for Weeks 2 through 4. Repetition is intentional. The customer
improves execution, pace, control, capacity, and consistency instead of receiving 28 unrelated
workouts.

The approved training formats and focus are:

| Assignment        | Format            | Focus                                        |
| ----------------- | ----------------- | -------------------------------------------- |
| Workout A         | Classic Intervals | Push + Legs                                  |
| Workout B         | EMOM              | Conditioning + Core                          |
| Workout C         | Lower Body Ladder | Legs + Muscular Endurance                    |
| Workout D         | Intervals         | Jump Conditioning + Full-Body Conditioning   |
| Workout E         | Pyramid Challenge | Total-Body Muscular Endurance + Conditioning |
| Active Recovery F | Active Recovery   | Mobility + Recovery                          |

The program-level equipment direction is jump rope plus bodyweight. Dumbbells, a bench, and gym
equipment are not part of the approved product. The launch gate still requires a video-by-video
audit before publishing that claim.

The weekly coaching focus is:

1. Set Your Baseline
2. Clean It Up
3. Raise Your Output
4. Finish Strong

## App structure and navigation

### Home

Home is an action-first dashboard, not a content library.

When a structured program is active, **Daily Assignment** is the first and largest card. Selecting
it opens the focused assignment for the current program day.

Home also provides clear access to:

- **My Programs**
- **Your Progress**
- **Your Nutrition**
- **Explore Programs**
- The in-app notification bell or inbox

Future membership, community, live, and challenge content may appear on Home without displacing the
Daily Assignment or turning Home into a crowded feed.

### My Programs

My Programs shows programs in these customer-facing states:

- Not Started
- Active
- Paused
- Completed

The completed free 7-Day Comeback Plan also appears in My Programs and remains available to open.

Opening a structured program shows:

- The current run.
- Overall program progress.
- The full program schedule.
- Completed days.
- The current actionable day.
- Locked future days.
- A separate **View Previous Runs** path when history exists.

Locked future days may show enough basic information to help the customer plan, including the day
title, workout type, expected runtime, and equipment. Full instructions and video remain locked
until that day becomes current.

Completed days remain available to reopen without changing progress.

### Your Progress

Your Progress shows the simple current view by default:

- Current program and progress.
- Latest weight, when available.
- Latest waist measurement, when available.

Detailed measurement history and previous program runs remain available behind another tap.

### Your Nutrition

The nutrition section is named **Your Nutrition**. It is a separate account-level paid-platform
feature, not a step inside the Accelerator. Owning the Accelerator may unlock it, but nutrition does
not start, pause, advance, complete, or otherwise control an Accelerator run. Its behavior requires
separate approval before implementation.

### Explore Programs

Explore Programs helps customers find and buy another program. Buying a program grants ownership
but does not automatically replace or start the current active program.

## Account, access, ownership, and enrollment

- One customer account must work across supported devices.
- Access is passwordless by secure email link or code.
- A verified purchase grants a durable product entitlement.
- The customer receives immediate access plus a backup access email.
- Purchased programs remain owned without expiration.
- Purchase and program start are separate facts.
- The free 7-Day signup uses one required, explicit checkbox covering plan-related emails and
  occasional Gen X Jumps marketing emails. Those consent records remain separately stored and
  independently withdrawable after signup.
- Public enrollment stays fail-closed until the full launch boundary is verified.

The paid program must not be forced into the free plan's `lead_plans` lifecycle. Security patterns
that already work may be reused, including normalized email, hashed opaque credentials,
non-enumerating recovery, idempotent writes, and server-enforced progress.

The current paid-only access-session foundation must be reconciled with the approved single-account
experience before the unapplied migration is accepted.

## Starting the Accelerator

The customer explicitly selects **Start Program** from a Not Started Accelerator.

The setup order is:

1. Todd's short welcome and orientation.
2. Optional starting weight and waist.
3. **Begin Day 1**.

The orientation contains a Todd welcome video and an equivalent written explanation. The customer
may watch, read, or use both.

Weight and waist are independently optional. Skipping either or both does not block Day 1. Starting
the program creates a new program run and sends the customer directly to the Day 1 assignment.

## Daily assignment

The focused daily assignment includes:

- Program day.
- Program week.
- Current progress.
- Workout, recovery, or rest assignment.
- Daily focus.
- Video when the assignment has one.
- Short practical instructions.
- Verified runtime.
- Verified equipment.
- One **Complete Day** button.

Completion is self-reported with one tap. Complete means complete by the customer's standard.

There is no required:

- Rating.
- Modification category.
- Workout log.
- Post-workout survey.
- Food log.

Video viewing and program-day completion are separate stored facts. Watching a video does not
complete the day, and completing the day does not claim that the whole video was watched.

Only the current incomplete day is actionable.

## Completion, undo, and next-day timing

After the customer completes Days 1 through 27, the app briefly shows:

- **Day X Complete**.
- Updated program progress.
- A path back to Home.

The completion state does not add a survey or another task.

After a completion, show a brief **Undo** option without adding a confirmation dialog before every
completion. Undo applies only to the day just completed. Once the customer moves forward, completed
history remains intact.

The next program day unlocks on the next calendar day, not immediately. The implementation audit
must define reliable customer-local day handling without changing this product rule.

## Missed days and returning

If the customer misses a day:

- Daily Assignment continues to show the same incomplete program day.
- The app does not stack two assignments.
- The app does not skip the assignment.
- The app does not label the customer behind.
- The remaining program days move with the customer.

The Daily Assignment card may adapt its message based on time since the last completed day:

- For the first one or two missed days, use straightforward supportive language.
- After several days, supportive humor may be introduced.
- Humor must never shame, scold, or guilt the customer.

The normal Daily Assignment card remains the resume path. A separate redundant resume button is not
required.

## Recovery days, rest days, and extra workouts

Active recovery and rest are real program assignments. The customer reviews the day's instruction
and uses the same **Complete Day** action to advance.

If a customer independently chooses to do another workout on a recovery or rest day, that workout
does not replace the structured assignment and does not independently advance the program.

## One active program and paused runs

Only one structured program may be active at a time.

Do not force a paying customer to finish an active free 7-Day run before starting the Accelerator.
Starting the Accelerator pauses the active 7-Day run and preserves its completed days.

The paused run appears in My Programs as **Paused**. If the customer later resumes it while the
Accelerator is active, show a clear warning that resuming it will pause the Accelerator. Switching
the active program never resets or overwrites either run.

## Repeating programs and version history

- A customer may repeat a completed purchased program without paying again.
- Each repeat creates a new program run.
- Previous runs are never reset or overwritten.
- A new run uses the latest available program version.
- Old runs preserve the version and content snapshot originally used.
- Previous runs remain behind **View Previous Runs** by default.

When starting another run, ask whether to use the customer's current measurements as the new
starting point. The customer may confirm, change, or skip them.

The data model must preserve program-run identity separately from purchase ownership and product
entitlement.

## Measurements and progress history

### Measurement rules

- Starting weight and waist are optional but encouraged.
- Weight and waist are independently optional.
- A missing value may be added later.
- An entry may be corrected.
- Either value may be removed without deleting the other.
- Detailed measurement history is retained in the backend.
- The default customer view remains simple.

The overall profile shows the latest weight and waist entered anywhere in the app. A current program
run shows its starting and newest measurements. A completed run preserves its start-to-finish
result.

The system must preserve enough history to distinguish:

- A global latest measurement.
- A run's starting measurement.
- The newest measurement associated with that run.
- A completed run's final result.
- Corrections and removals.

The current one-row-per-week check-in foundation must be audited against these requirements before
the migration is applied.

### Weekly reminders

Measurement reminders follow the customer's program week, not the calendar week. Starting
measurements are handled during setup.

During later program weeks, the in-app notification bell or inbox may show a reminder such as:

> You haven't added your weight or waist this week.

The customer may open the measurement form or dismiss the reminder. Dismissing it silences that
reminder for the rest of the current program week. It does not remove measurement entry from Your
Progress.

Notifications are in-app only for the Accelerator launch. Browser or phone push notifications are
future work.

### Day 28 measurement

Completing Day 28 and entering final measurements are separate actions. The completion experience
offers one final optional weight and waist entry so the run can show a true start-to-finish result.
The customer may skip it without affecting completion.

## Day 28 completion experience

The completed-run summary shows:

- Program completion.
- Final progress.
- Start-to-finish weight and waist changes when enough optional data exists.
- A repeat-program option.
- Other available programs.
- A future membership offer when membership is available.

The 7-Day Comeback Plan and Accelerator will eventually earn distinct completion badges. Badges are
future work, but completion history must support retroactive awards.

## In-app messaging and comeback email

In-app messaging is the primary reminder system. Email is a light rescue channel for customers who
have clearly stopped returning.

The first in-app behavior is an optional program-week measurement reminder in Weeks 2-4. It appears
only after the prior seven-day block is complete and the next program day is available. Adding
either a progress weight or waist entry satisfies the check-in. Dismissing it silences only the
current program week; it does not hide measurement entry or change progress.

Use one platform-wide comeback policy rather than creating overlapping campaigns for every owned
program:

- Watch only the one active structured program.
- Trigger inactivity from no completed program days, not merely from app opens.
- Not Started, Paused, and Completed programs send nothing.
- Start the inactivity clock from the later of the active program's start or resume time and its
  latest completed workout.
- Use elapsed time, not customer-local calendar midnights: the first comeback message is due at
  four inactive days and the second at ten inactive days.
- Then remain silent for that uninterrupted absence.
- Returning and completing a day stops the active comeback sequence.
- Customers can turn program reminders off.
- Future structured programs reuse the same rules with program-specific wording.

The in-app Inbox may show the current eligible comeback message, but it is not a phone push or an
email send. The approved V1 copy is:

- Four days: **Your next workout is waiting.** “You don’t need to make up anything. Open the app,
  do today’s workout, and keep moving.”
- Ten days: **Your program’s still here.** “Nothing’s ruined. You don’t need to restart or catch
  up. Your next workout is waiting when you’re ready.”

Do not create daily nagging or let the number of owned programs multiply email volume.

When email delivery is separately built and approved, it uses an independent Email reminder
preference alongside the In-app reminder preference. Customers can select in-app, email, both, or
neither. Paid-program email launch also includes purchase/access delivery and user-requested
recovery. Production activation remains a separate controlled checkpoint.

## Your Nutrition and Protein First

Your Nutrition is separate from the Accelerator experience. It may be unlocked by ownership of the
Accelerator or another qualifying paid program, but it lives in the platform's **Your Nutrition**
section. It is not mixed into daily assignments, weekly coaching, completion, or Accelerator
reminders, and nutrition actions never block program progress.

Protein First teaches:

- Calories still matter.
- Protein comes first.
- Build meals around protein.
- Do not obsess over exact carbohydrate and fat ratios.
- Avoid obvious calorie bombs.
- Repeat simple meals that work.
- Protein supports muscle preservation, recovery, and hunger control.
- If fat loss stalls, adjust portions or calorie-dense foods before rebuilding the whole diet.

The launch does not require mandatory food logging, a large recipe system, or a rigid meal plan.

The protein formula is not approved. Do not reuse the old one-gram-per-pound-of-current-weight
language. Formula selection requires deliberate research and safety review, especially for
customers carrying substantial excess weight. The working `1.6 g/kg` idea is not approved product
logic.

## Todd's private launch view

The launch includes a simple private customer-progress view for Todd. It is not a full analytics
dashboard.

The view is account-bound through a server-only private allow-list. It does not appear in the
customer navigation, and a signed-in customer who is not on that allow-list receives no customer
data. It is read-only and excludes editing programs, purchases, refunds, email, reminders, or
customer access.

For each customer or run, it shows enough information to identify:

- Enrolled but not started.
- Current program.
- Current program day.
- Last completed day and completion date.
- Paused or inactive.
- Completed.
- Starting, latest, and final weight and waist when recorded.

The first view is limited to active Accelerator ownerships. Its filters are All, Active, Paused,
Completed, and Active but inactive for four or more days. It is intentionally not a replacement
for a future support, payments, or analytics system.

The underlying system should save enough detail to support later program funnel and retention
analysis without crowding the first admin view.

## Display principle

**Save the detail, display the simple version.**

Default customer screens prioritize:

- Today's assignment.
- The current program run.
- Current progress.
- Latest measurements.

Historical measurements, previous runs, version details, and deeper records stay behind another
tap.

## Foundation reconciliation gate

The private foundation merged in PR #16 predates this expanded product contract. The unapplied
migration and current implementation must be audited before being changed or applied.

At minimum, the audit must compare the current foundation with these approved requirements:

- One account across devices instead of a paid-only access silo.
- Not Started, Active, Paused, and Completed program-run states.
- One active structured program at a time.
- Switching programs without resetting either run.
- Repeat runs and previous-run history.
- Next-calendar-day unlocking after completion.
- Reopenable completed days and locked future-day previews.
- Immediate completion undo for only the latest completed day.
- Video-view and day-completion facts stored separately.
- Detailed, editable, removable measurement history.
- Starting, latest, and final measurements per run.
- Dismissible program-week measurement reminders.
- Platform-wide inactivity messaging and reminder preferences.
- The simple private progress view.

This list is an audit checklist, not permission to change the implementation silently. If the code,
migration, tests, and this contract conflict, report the conflict and obtain Todd's approval for the
proposed correction before implementation.

## Launch verification requirements

All requirements remain unverified until a future checkpoint attaches concrete evidence.

| Requirement                        | Current state          | Evidence needed                                             |
| ---------------------------------- | ---------------------- | ----------------------------------------------------------- |
| Workouts A-E and Active Recovery F | Unverified             | Correct files present, ordered, and playable                |
| Workout runtimes                   | Unverified             | Final encoded A-E runtimes support the public time claim    |
| Equipment                          | Unverified             | A-F audit supports rope/bodyweight/no-gym claims            |
| Weekly coaching                    | Unverified             | Four finished coaching primers placed in the program        |
| Paid-platform nutrition            | Separately scoped      | Approved access, content, and any target logic tested       |
| Measurement behavior               | Foundation needs audit | Final private UI and accepted history behavior are verified |
| Customer account and access        | Foundation needs audit | Cross-device passwordless account behavior is verified      |
| Program-run lifecycle              | Foundation needs audit | Start, pause, resume, repeat, and history are verified      |
| Checkout handoff                   | Unverified             | $37 test purchase creates the intended ownership and access |
| Refund path                        | Unverified             | Seven-day request path and policy are operational           |
| Comeback messaging                 | Unverified             | In-app and bounded email behavior are verified              |
| Resume behavior                    | Foundation needs audit | Applied development behavior matches this contract          |
| Todd's private progress view       | Unverified             | Authorized private status view is complete and tested       |

## Claims that must stay unpublished until verified

- Exact workout runtimes.
- Final equipment requirements.
- Availability of four weekly coaching videos.
- Availability, eligibility, or formula of Your Nutrition targets.
- Working measurement and history behavior.
- Working purchase-to-account access.
- Working refund handling.
- Working comeback messaging.
- Public enrollment availability.

Do not add fake pricing, discounts, scarcity, countdowns, testimonials, transformations, guaranteed
results, live-coaching claims, or guaranteed direct access to Todd.

## Explicitly outside the Accelerator launch

- Netflix-style video-library expansion.
- Membership implementation.
- Community.
- Live workouts.
- Challenges.
- Coaching or direct messaging.
- Broad on-demand workout-library expansion.
- Approved 10-minute substitutes.
- Phone or browser push notifications.
- Completion badges and levels.
- Mandatory food logging.
- A large recipe system.
- A rigid meal plan.
- Full admin analytics and reporting.
- Visual redesign beyond what the functional release requires.

## Actions not authorized by this document

- Applying the current Accelerator migration.
- Opening public enrollment.
- Adding public navigation to the Accelerator.
- Calling a payment provider.
- Sending production Accelerator email.
- Migrating live customers.
- Publishing through McLovable.
- Publishing unaudited runtime, equipment, nutrition, or availability claims.
