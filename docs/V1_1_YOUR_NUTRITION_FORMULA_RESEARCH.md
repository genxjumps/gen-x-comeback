# Checkpoint 6 - Proposed nutrition formula research

**Status:** Proposed research only. This document does not approve numerical behavior or
customer-facing copy. Do not implement from it until Todd explicitly approves the method.

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
- Current fitness goal
- Desired body-weight direction
- Typical movement outside workouts
- Current training type
- Typical meal occasions and largest meal

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
| Lose fat and lose weight | Maintenance minus 10%, with an internal maximum reduction of 500 calories |
| Add lean muscle and lose fat, while losing weight | Maintenance minus 5-10%, with an internal maximum reduction of 300 calories |
| Add lean muscle and lose fat, while maintaining or slowly adding weight | Estimated maintenance |
| Add lean muscle and add weight slowly | Estimated maintenance. No automatic bulk surplus. |
| Maintain results | Estimated maintenance |

The 500-calorie maximum is a ceiling, not a promise of universal safety and not the default
reduction. The 10% calculation controls most starting results.

Never generate a target below 1,200 calories. If a required guardrail would force a low-calorie or
otherwise unsuitable result, the app must stop and show its short registered-dietitian notice rather
than pretend the target is individualized care.

### 4. Protein reference weight and target

Use a protein reference weight to avoid assigning protein from every pound of excess body weight:

```
reference weight (kg) = min(current weight (kg), 30 × height (m)^2)
```

| Goal | Proposed protein target |
| --- | ---: |
| Lose fat or maintain results | 1.4 g/kg reference weight |
| Add lean muscle, with or without fat loss | 1.6 g/kg reference weight |

Round to the nearest 5 grams. Do not use the prior free-plan one-gram-per-pound target, a blanket
1.6 g/kg of current weight, or arbitrary 70/180g hard caps.

### 5. Carbohydrate and fat targets

- Fat: 25% of total target calories.
- Carbohydrate: remaining calories after protein and fat.
- Raise the calorie result, if needed, so protein does not exceed 30% of calories. This preserves
  room for 25% fat and at least 45% carbohydrate in the displayed macro pattern.
- Round protein, carbohydrates, and fat to the nearest 5 grams.

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

| Profile | Estimated maintenance | Proposed daily target |
| --- | ---: | ---: |
| Todd: 60M, 6 ft 1, 175 lb, mostly sitting | 2,100 | 1,900 for fat loss |
| Todd: same inputs, on feet most of the day | 2,350 | 2,150 for fat loss |
| 55F, 5 ft 4, 205 lb, mostly sitting, fat loss | 1,900 | 1,750 |
| 60M, 6 ft 1, 235 lb, on feet, fat loss | 2,750 | 2,500 |
| 65F, 4 ft 11, 200 lb, mostly sitting, fat loss | 1,700 | 1,550 |
| 58F, 5 ft 6, 155 lb, on feet, recomposition | 1,850 | 1,850 |
| 55M, 5 ft 10, 170 lb, on feet, slow lean gain | 2,300 | 2,300 |

Todd's stated real maintenance routine has generally been in the 2,000-2,300 calorie range. The
two calibration outputs bracket that lived experience. This is a useful sanity check, not proof of
accuracy for other customers.

## Still requires Todd approval

1. The conservative movement multipliers.
2. The 10% fat-loss starting deficit and 5-10% recomp deficit.
3. The BMI-30 protein reference weight method.
4. The 1.4 / 1.6 g/kg protein tiers.
5. The 25% fat / carbohydrate remainder method.
6. The guardrail behavior and short registered-dietitian notice.
7. The manual review window and wording.
