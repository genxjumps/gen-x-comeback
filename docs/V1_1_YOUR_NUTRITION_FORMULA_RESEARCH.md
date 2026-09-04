# Checkpoint 6 - Nutrition formula and evidence

**Status:** Calorie direction and safety boundary approved by Todd on 2026-09-04. The protein
formula is reopened after review and must not be implemented from this document until Todd approves
the revised muscle-first rule. This remains general nutrition guidance, not individualized medical
nutrition care.

## What this proposal is trying to do

Give a paid Gen X Jumps customer a conservative, practical starting target without pretending an
app can know their exact energy needs. The result must create room for fat loss when that is the
goal, while protecting normal eating, training, recovery, and muscle as people age.

A target is a starting estimate. Real weight, waist, adherence, training, recovery, and hunger
determine whether it was close enough.

## Evidence used

- The Mifflin-St Jeor equation estimates resting energy expenditure from weight, height, age, and
  sex. It is a reasonable starting equation, not a measurement of an individual's exact calorie
  needs. [Original study](https://pubmed.ncbi.nlm.nih.gov/2305711/)
- Older-adult weight-loss research supports calorie restriction, but also identifies lean-mass and
  bone-loss concerns. A recent review calls for moderate restriction alongside adequate protein and
  resistance exercise. It does not make a generic calorie calculator individually safe for every
  adult. [Review](https://pubmed.ncbi.nlm.nih.gov/40065568/)
- Older adults generally need more deliberate protein than the basic adult RDA. For weight loss in
  people with obesity, a review specifically discusses at least 1.2 g/kg/day using a maximum weight
  of BMI 30. [Protein in obesity review](https://pubmed.ncbi.nlm.nih.gov/39514335/)
- Protein plus resistance training supports strength and lean-mass gains; the evidence does not
  support endlessly raising protein above approximately 1.6 g/kg/day for more gain.
  [Meta-analysis](https://pubmed.ncbi.nlm.nih.gov/28698222/)
- The NIH Body Weight Planner also treats calorie plans as models of changing energy balance rather
  than a simple fixed pounds-per-calorie promise. [NIH explanation](https://www.niddk.nih.gov/health-information/professionals/diabetes-discoveries-practice/nih-body-weight-planner)

## Proposed calculation candidate

### 1. Inputs

- Sex used by the Mifflin-St Jeor equation
- Age
- Height
- Current body weight
- Goal weight, when body weight is changing
- Current fitness goal
- Desired body-weight direction
- Typical movement outside workouts
- Current training type
- Typical meal occasions and largest meal

Goal weight confirms the direction of change and gives the existing Progress experience useful
context. It does **not** directly set the starting calorie or protein number. A goal weight without
a time frame cannot responsibly determine a daily energy target.

Training type remains useful for protein and education. It does **not** add assumed exercise
calories because the tool does not know how often, how long, or how hard a customer trains.

### 2. Estimated maintenance calories

Use Mifflin-St Jeor resting energy expenditure, then only this conservative daily-movement
calibration:

| Typical day outside workouts | Proposed multiplier |
| --- | ---: |
| Mostly sitting | 1.25 |
| On your feet most of the day | 1.40 |
| Physically active work | 1.55 |

Round estimated maintenance **up** to the nearest 50 calories. The multipliers are product
calibration choices, not claims of individual precision.

### 3. Calorie result by goal

| Customer situation | Proposed starting calorie behavior |
| --- | --- |
| Any goal paired with Lose weight | Maintenance minus 10%, with an internal maximum reduction of 500 calories |
| Any goal paired with Maintain current weight | Estimated maintenance |
| Any goal paired with Add weight slowly | Estimated maintenance. No automatic bulk surplus. |

The 500-calorie maximum is a ceiling, not a promise of universal safety and not the default
reduction. The 10% calculation controls most starting results.

Never generate a target below 1,200 calories. If the calculated result falls below that boundary,
the app must stop and show its short registered-dietitian notice. It must not quietly raise the
number to 1,200 and present that as an individualized plan.

### 4. Protein reference weight and target

All customer-facing body-weight inputs and explanations use **pounds**. Customers see a daily
protein target in **grams** - for example, “175 g per day.” They never see g/kg, a kilograms
conversion, or the underlying formula.

Research notes can use g/kg when a source uses that unit, but the unit must always be spelled out.
Any internal kilograms conversion for calorie math is implementation-only and must use explicit
unit names in code and tests.

The prior 1.6 g/kg reference-weight proposal is **not approved**. It produced a 125 g target for
Todd at 175 lb, which would incorrectly make a lower intake look like the product's muscle-first
recommendation.

The revised rule must use a clear **protein reference weight in pounds**. It must preserve a
practical high-protein target for leaner customers training to build muscle and lose fat, while
avoiding an absurd calculation from every pound of excess body weight. It must be recalibrated and
approved before implementation.

Do not use the prior free-plan one-gram-per-pound target, the prior blanket 1.6 g/kg reference
weight proposal, or arbitrary 70/180g hard caps without a deliberate replacement decision.

### 5. Carbohydrate and fat targets

- Fat: 25% of total target calories.
- Carbohydrate: remaining calories after protein and fat.
- Round protein, carbohydrates, and fat to the nearest 5 grams.
- Do not silently raise calories to make a macro ratio look cleaner. If a future safety or
  suitability guardrail prevents a sensible result, stop and show the registered-dietitian notice.

This is a simple default macro structure. It is not carb cycling, a food log, or a claim that one
carb-to-fat ratio is best for everyone.

## Draft manual review behavior

V1 does not change targets automatically.

If a customer is not seeing the expected trend after a sustained period of honest consistency, the
first review is portions, drinks, dressings, sauces, calorie-dense foods, and serving sizes. The
app does not tell them to cut calories because of a few scale readings or a single off-target day.

The exact review window and optional later 100-150 calorie manual adjustment remain open.

## Calibration checks

These are internal tests, not customer examples or promises.

| Profile | Maintenance | Result | Protein | Carbs | Fat |
| --- | ---: | ---: | ---: | ---: | ---: |
| Todd: 60M, 6 ft 1, 175 lb, mostly sitting, lose weight | 2,100 | 1,900 | Recalculate | Recalculate | Recalculate |
| Todd: same inputs, on feet most of the day, lose weight | 2,350 | 2,100 | Recalculate | Recalculate | Recalculate |
| 55F, 5 ft 4, 205 lb, mostly sitting, lose weight | 1,900 | 1,700 | Recalculate | Recalculate | Recalculate |
| 60M, 6 ft 1, 235 lb, on feet, lose weight | 2,750 | 2,500 | Recalculate | Recalculate | Recalculate |
| 65F, 4 ft 11, 200 lb, mostly sitting, lose weight | 1,700 | 1,550 | Recalculate | Recalculate | Recalculate |
| 58F, 5 ft 6, 155 lb, on feet, maintain | 1,850 | 1,850 | Recalculate | Recalculate | Recalculate |
| 55M, 5 ft 10, 170 lb, on feet, add weight slowly | 2,300 | 2,300 | Recalculate | Recalculate | Recalculate |
| 70F, 4 ft 10, 110 lb, mostly sitting, lose weight | 1,150 | Dietitian notice | - | - | - |
| 50M, 6 ft 5, 350 lb, physical work, lose weight | 4,000 | 3,600 | Recalculate | Recalculate | Recalculate |

Maintenance is rounded up to the next 50 calories. A fat-loss result is 10% below maintenance,
capped at 500 calories, then rounded to the nearest 50. The protein rule and dependent carbohydrate
and fat results must be recalculated after the revised protein decision.

Todd's stated real maintenance routine has generally been in the 2,000-2,300 calorie range. The
two calibration outputs bracket that lived experience. This is a useful sanity check, not proof of
accuracy for other customers. The short, older profile proves the boundary behavior: the app shows
the dietitian notice instead of inventing a low-calorie target.

## Still open before implementation

1. Run and approve deterministic calibration and boundary cases, including low-calorie, short,
   tall, high-bodyweight, and goal-direction combinations.
2. Confirm input ranges, customer-facing pounds/grams-only presentation, and the exact short
   registered-dietitian notice.
3. Approve the revised muscle-first protein rule, then recalculate all protein, carbohydrate, and
   fat calibration results.
4. Lock slider limits, meal-allocation rounding, and protein-spread behavior.
5. Lock the manual review window and wording.
6. Verify Todd's Normal Day labels and portions before publishing its totals.
