# Checkpoint 6 - Your Nutrition approval brief

**Status:** Draft for Todd's product approval. This document defines the smallest credible V1
experience. It authorizes neither calculations nor customer-facing nutrition behavior until the
open decisions below are approved.

## Purpose

Your Nutrition helps a paid customer turn simple starting targets into a normal day of eating they
can repeat. It is practical guidance, not a diet plan, recipe product, food diary, or macro
tracker.

The point is not to make eating more complicated. The point is to give the customer a useful
starting point, then help them repeat the meals and portions that work.

## Product boundary

- **Your Nutrition** is an account-level paid-platform feature, reached from the Your Nutrition
  tab.
- It is separate from a 28-Day Accelerator run. It does not start, pause, unlock, advance, or
  complete workouts.
- The free 7-Day Comeback Plan does not unlock it. A free customer may see a locked entry point,
  but cannot enter setup or view saved nutrition data.
- Any paid entitlement deliberately marked as nutrition-eligible unlocks the feature. At launch,
  that is the Accelerator entitlement. Future paid programs can opt in without changing the
  customer-facing model.
- Access begins with ownership, not the start of an Accelerator run. It remains available when a
  run is paused, completed, restarted, or switched away from.
- Nutrition information belongs to the customer account. If every qualifying entitlement is later
  revoked, access can lock, but saved information is retained rather than deleted.
- Nutrition never blocks workout progress.

## Approved teaching direction

The customer sees and can revisit this guidance:

- Calories still matter.
- Protein comes first.
- Build meals around protein.
- Do not obsess over exact carbohydrate and fat ratios.
- Avoid obvious calorie bombs.
- Repeat simple meals that work.
- Protein supports muscle preservation, recovery, and hunger control.
- If fat loss stalls, adjust portions or calorie-dense foods before rebuilding the whole diet.

The operating message is: **Calories still matter. Protein comes first. Meals stay simple.**

## Recommended V1 customer flow

### 1. Locked state

A customer without an eligible paid ownership sees a short, honest explanation that Your Nutrition
is available with an eligible paid program. No targets, demo targets, or implied health claims are
shown.

### 2. Welcome

An eligible customer lands on a short explanation of Protein First and sees a single action:
**Set up my starting targets**. The page makes clear that targets are a starting estimate, not a
prescription, and that the tool does not require food logging.

### 3. Starting-target setup

The calculator collects only the inputs needed by the approved calculation method:

- sex
- age
- height
- current weight
- normal daily movement outside the program workouts

It does not ask the person to guess workout calories, workout duration, or training frequency. The
platform already knows the program context, and V1 does not use exercise-calorie eat-back logic.

The final field labels, units, valid ranges, skip handling, and medical/safety copy depend on the
formula decision. This screen must not ship until those decisions are approved and tested.

### 4. Starting targets

The result shows only:

- starting daily calories
- daily protein target
- plain-language carbohydrate and fat guidance without prescribing exact macro ratios
- protein-per-eating-time guidance based on the customer's chosen meal rhythm
- a clear statement that the numbers are starting estimates to test against real life and progress

V1 does not display calories burned, exercise calories to eat back, competing goal modes, rigid
menus, or bodybuilding-style macro targets.

### 5. Normal Eating Day

The bridge from numbers to behavior asks the customer to choose the eating rhythm that naturally
fits their life, then save **one to three repeatable default meals**.

Each default meal is a short customer-written template, not a recipe:

- meal name or eating time
- the protein-centered meal they tend to eat
- an optional short note about the portion or common calorie-dense item to watch

The resulting Normal Eating Day is a compact summary of the meal rhythm, targets, and default
meals. It is editable. It is not a prescribed meal plan and does not require meal-by-meal logging.

### 6. Revisit and simple check-in

The main Your Nutrition page always lets the customer revisit the Protein First guidance, their
current targets, and their Normal Eating Day. Existing optional weight and waist history remains
the platform's measurement record; Nutrition must not create a second measurement system.

V1 gives manual, non-automatic review guidance: if results have stalled, first look at portions and
calorie-dense foods before tearing up the whole approach. It does not score adherence, decide that
someone has stalled, change targets automatically, or create a target-history dashboard.

## Explicitly out of V1

- mandatory food logging or detailed daily macro tracking
- calorie or workout "eat back" calculations
- carb cycling or multiple fitness-goal modes
- rigid meal plans, generated one-day/seven-day menus, or a large recipe library
- AI meal generation, food checker, grocery list, restaurant guidance, substitutions, or saved
  recipe system
- barcode scans or meal-photo analysis
- adherence scores, automatic progress analysis, automatic target changes, or target-history
  dashboards

## Decisions that remain open

These choices must be resolved before implementation begins:

1. **Calorie method:** calculation, movement categories, rounding, floors, maximum deficit, and
   what the app says when an estimate is not appropriate.
2. **Protein method:** weight basis, calculation, rounding, lower/upper guardrails, and how to
   handle substantial excess weight.
3. **Health and safety boundary:** age suitability, caution/stop copy, and when the app directs a
   customer to a qualified clinician rather than gives a target.
4. **Meal rhythm:** the exact customer choices and how protein-per-eating-time guidance is derived
   from them.
5. **Default meal details:** whether the optional note is enough or whether V1 needs one additional
   structured prompt to make default meals more actionable.
6. **Manual review prompt:** the exact customer-facing wording and the point at which the app
   invites a customer to reassess portions and calorie-dense foods.

## Formula guardrail

No numerical calorie or protein logic is approved by this document.

Do not reuse the free 7-Day one-gram-per-pound language. The earlier working approximately
1.6 g/kg idea, its rounding, and its proposed minimum/maximum are historical discussion only, not
approved customer-facing logic. Any selected method must be researched for adults 50+, evaluated
for customers carrying substantial excess weight, reviewed by Todd, and covered by deterministic
tests before release.

## Approval path

1. Todd approves or changes the product boundary and V1 flow above.
2. Research produces a separate evidence-backed formula recommendation and safety language.
3. Todd approves the exact numerical behavior and copy.
4. One bounded implementation branch adds entitlement gating, storage, setup, results, Normal
   Eating Day, and tests. It does not change Accelerator progression, checkout, email, or the free
   7-Day Plan.
5. The complete quality gate passes before a pull request is merged. Publication remains a separate
   controlled action.
