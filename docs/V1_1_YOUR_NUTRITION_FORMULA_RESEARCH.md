# Checkpoint 6 - Nutrition formula and evidence

**Status:** Calorie direction, safety boundary, and the tested muscle-first protein method were
approved by Todd on 2026-09-04. Final customer copy, remaining interaction rules, implementation,
and release are still gated. This remains general nutrition guidance, not individualized medical
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

Nutrition reuses the existing 7-Day inline bodyweight-unit selector: **lb** or **kg** beside the
Current weight field. When the customer has an existing saved weight, Nutrition prefills its unit.
The same selected unit applies to Current weight and Goal weight. Nutrition does not introduce a
separate account-wide unit preference.

Height needs its own clear entry control: feet/inches or centimeters. It can remember the last
choice, but it must not make a customer translate. Daily protein remains in **grams** in either
case because food labels and supplements use grams - for example, “175 g per day.”

Customers never see g/kg, g/lb, a unit conversion, or the underlying formula. Research notes can
use g/kg when a source uses that unit, but the unit must always be spelled out. Any internal
conversion for calorie math is implementation-only and must use explicit unit names in code and
tests.

### Approved input validation

- Current and goal weight reuse the existing 7-Day bounds: 70-700 lb or 32-318 kg.
- Age: 18-100.
- Height: 4 ft 0 in-7 ft 0 in or 122-213 cm.
- Current and goal weight use the same selected unit.
- Lose weight requires a goal below current weight.
- Maintain current weight does not require a goal weight.
- Add weight slowly requires a goal above current weight.
- A goal below the standard height-based healthy range stops the calculation.
- Any calculated calorie target below 1,200 stops the calculation.
- Invalid or stopped calculations never invent a replacement number. They show the short
  registered-dietitian notice.

These are typo and suitability guardrails, not a claim that every person inside the ranges is
automatically suitable for generalized nutrition targets.

The prior 1.6 g/kg reference-weight proposal is **not approved**. It produced a 125 g target for
Todd at 175 lb, which would incorrectly make a lower intake look like the product's muscle-first
recommendation.

The approved method uses a clear **protein reference weight in pounds**:

1. When maintaining body weight, start with current weight.
2. When losing or adding weight, start with goal weight.
3. If that weight exceeds the upper end of the standard height-based healthy range, cap the
   internal reference at the BMI-24.9 weight for that height.
4. If a goal is below the lower end of the standard healthy range, stop for correction rather than
   calculate from it.
5. Baseline target: 1.0 g per pound of protein reference weight.
6. Regular strength training or combined strength and conditioning: 1.1 g per pound of protein
   reference weight.
7. Do not stack separate age, fitness-goal, and training bonuses. The 50+ baseline and one active
   muscle factor are the complete product rule.
8. Round the final protein target to the nearest 5 grams.

“Regular strength training” is triggered only by the customer's current-training answer of
Strength training or Both. A lean-muscle goal without resistance training does not create a fake
training bonus; the app explains that protein alone does not build muscle.

The 1.0 and 1.1 g/lb levels are deliberate Gen X Jumps muscle-first product standards. They are
not presented as clinical requirements or as exact thresholds proven for every older adult.

Do not use the prior blanket 1.6 g/kg reference-weight proposal or arbitrary 70/180g hard caps.

### 5. Carbohydrate and fat targets

- Fat: 25% of total target calories.
- Carbohydrate: remaining calories after protein and fat.
- Round protein, carbohydrates, and fat to the nearest 5 grams.
- Do not silently raise calories to make a macro ratio look cleaner. If a future safety or
  suitability guardrail prevents a sensible result, stop and show the registered-dietitian notice.

This is a simple default macro structure. It is not carb cycling, a food log, or a claim that one
carb-to-fat ratio is best for everyone.

## Approved V1 review boundary

V1 does not verify intake, run an adherence audit, collect temporary calorie logs, or change
targets automatically or through a suggested calorie-reduction workflow.

If a customer is not seeing the expected trend, the app gives brief guidance to review portions,
drinks, dressings, sauces, calorie-dense foods, serving sizes, and consistency. It does not pretend
to know what the customer ate. The customer can update current weight, goal, movement, or training
and deliberately recalculate starting targets at any time.

## Calibration checks

These are internal tests, not customer examples or promises.

| Profile | Maintenance | Result | Protein | Carbs | Fat |
| --- | ---: | ---: | ---: | ---: | ---: |
| Todd: 60M, 6 ft 1, 175 lb, 175 goal, strength, mostly sitting, lose weight | 2,100 | 1,900 | 195 g | 155 g | 55 g |
| Todd: same inputs, on feet most of the day, lose weight | 2,350 | 2,100 | 195 g | 205 g | 60 g |
| 55F, 5 ft 4, 205 lb, 160 goal, no strength, sitting, lose weight | 1,900 | 1,700 | 145 g | 180 g | 45 g |
| Same profile with strength training | 1,900 | 1,700 | 160 g | 165 g | 45 g |
| 60M, 6 ft 1, 235 lb, 200 goal, strength, on feet, lose weight | 2,750 | 2,500 | 210 g | 260 g | 70 g |
| 65F, 4 ft 11, 200 lb, 140 goal, strength, sitting, lose weight | 1,700 | 1,550 | 135 g | 150 g | 45 g |
| 58F, 5 ft 6, 155 lb, strength, on feet, maintain | 1,850 | 1,850 | 170 g | 180 g | 50 g |
| 55M, 5 ft 10, 170 lb, 180 goal, strength, on feet, add slowly | 2,300 | 2,300 | 190 g | 240 g | 65 g |
| 70F, 4 ft 10, 110 lb, mostly sitting, lose weight | 1,150 | Dietitian notice | - | - | - |
| 50M, 6 ft 5, 350 lb, 250 goal, strength, physical work, lose weight | 4,000 | 3,600 | 230 g | 445 g | 100 g |
| Metric: 60M, 185 cm, 79 kg to 77 kg, strength, sitting, lose weight | 2,100 | 1,900 | 185 g | 165 g | 55 g |

Maintenance is rounded up to the next 50 calories. A fat-loss result is 10% below maintenance,
capped at 500 calories, then rounded to the nearest 50. Protein, carbohydrate, and fat are rounded
to the nearest 5 grams.

Todd's stated real maintenance routine has generally been in the 2,000-2,300 calorie range. The
two calibration outputs bracket that lived experience. This is a useful sanity check, not proof of
accuracy for other customers. The short, older profile proves the boundary behavior: the app shows
the dietitian notice instead of inventing a low-calorie target.

## Still open before implementation

1. Convert the approved calorie, protein, carbohydrate, fat, input-validation, and boundary cases
   into deterministic tests during implementation.
2. Convert the approved meal-slider defaults, recalculation, and rounding behavior into
   deterministic tests during implementation.
3. Verify My Normal Day labels and portions before publishing its totals.
