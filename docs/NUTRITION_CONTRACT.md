# Your Nutrition Contract

**Role:** Contract

This document defines the durable V1 Nutrition behavior. The approval brief, research, evidence,
and calibration history are preserved under `docs/history/`.

## Access and independence

- Your Nutrition is account-level and unlocks from a qualifying active paid entitlement. At V1,
  the 28-Day Fat Loss Accelerator qualifies.
- The free 7-Day Plan does not unlock Nutrition. A free customer may see the locked destination.
- Nutrition remains available when an Accelerator run is Not Started, Active, Paused, Completed,
  repeated, or switched away from.
- Nutrition data is retained if qualifying ownership is later revoked, but access locks.
- Nutrition never starts, pauses, advances, completes, or blocks a workout or program run.

## Inputs and target calculation

The setup collects fitness goal, weight direction, current and goal weight, height, age, sex, daily
activity, current training, normal eating occasions, and largest meal. Weight supports pounds and
kilograms; height supports feet/inches and centimeters.

- Estimate resting energy with Mifflin-St Jeor.
- Apply only the approved daily-activity multiplier: 1.25 mostly sitting, 1.40 on feet most of the
  day, or 1.55 physically active work.
- Round maintenance up to the nearest 50 calories.
- Lose weight uses 10 percent below maintenance with a maximum 500-calorie reduction. Maintain and
  add slowly begin at estimated maintenance.
- Never return a target below 1,200 calories. Stop and show the registered-dietitian notice instead
  of silently raising or inventing a number.
- Protein uses the approved reference weight: current weight for maintenance, goal weight for loss
  or gain, capped internally at the BMI-24.9 weight for height when applicable.
- Protein is 1.0 gram per reference pound, or 1.1 grams with current strength training or combined
  strength and conditioning. Round to the nearest 5 grams.
- Fat is 25 percent of target calories. Carbohydrate receives the calories remaining after protein
  and fat. Round carbohydrate and fat to the nearest 5 grams.
- The customer sees practical daily targets, not the underlying g/kg, g/lb, or BMI calculation.

## Meal allocation and guidance

- Breakfast, lunch, dinner, and snack sliders redistribute the day without changing daily totals.
- Active eating occasions move in one-percent increments and may go as low as 5 percent.
- The tool teaches a repeatable protein-first normal day. It is not a food log, rigid meal plan,
  recipe generator, adherence score, or automatic coaching system.
- Customers may deliberately update inputs and recalculate. The app does not automatically change
  targets from weight, waist, guessed adherence, or workout calories.
- Starting targets are estimates and general nutrition guidance, not medical nutrition care.

## Boundaries

- Weight and waist history remains the platform measurement record. Nutrition does not create a
  second measurement system.
- My Normal Day may show Todd's verified example foods and portions. It must not publish calculated
  totals from unverified labels or serving sizes.
- The free 7-Day protein guidance remains separate and is not silently replaced by this formula.
