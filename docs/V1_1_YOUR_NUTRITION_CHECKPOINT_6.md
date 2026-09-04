# Checkpoint 6 - Your Nutrition approval brief

**Status:** Product behavior, calorie direction, safety boundary, and the calibrated muscle-first
protein method were approved by Todd on 2026-09-04. Meal-allocation math, final examples,
implementation, and release remain gated by the open decisions below.

## Purpose

Your Nutrition helps a paid customer turn personal calorie and macro targets into a normal day of
eating they can repeat. It is practical guidance, not a food diary, recipe product, or macro
tracker.

The point is to make the numbers visible across a whole day, then help the customer repeat meals
that are enjoyable, filling, and fit those numbers.

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
- Watch liquid calories and calorie-dense extras, especially dressings and mayo.
- Know the difference between total carbs and added sugars. Read the label.
- Repeat simple meals that work.
- Protein supports muscle preservation, recovery, and hunger control.
- If fat loss stalls, adjust portions or calorie-dense foods before rebuilding the whole diet.
- One off-target meal does not erase the day. Make the next choice better and keep going.

The operating message is: **Calories still matter. Protein comes first. Meals stay simple.**

The guidance gives customers a direct check before they change their whole diet:

> Check what you are drinking and what you are pouring. Regular soda, juice, sweetened coffee or
> tea, and calorie-containing flavored drinks can add up fast. Dressing, mayo, oils, butter,
> cheese, ketchup, and barbecue sauce can do the same. Read the label. Check the serving size.
> Measure it when needed.

Zero-calorie drinks are not treated as a problem. The lesson is to account for drinks and extras
that actually contain calories.

### Read the label: carbs, sugar, and serving size

The app teaches this distinction without turning carbs into the enemy:

- Sugars and most starches are digested into glucose, which the body uses for energy.
- That does **not** make a potato, oats, beans, fruit, or rice the same as soda, candy, or a
  heavily sweetened packaged food. Whole foods often bring fiber, volume, and other nutrients.
- **Total Carbohydrate** tells the customer how much carbohydrate is in a serving.
- **Added Sugars** tells them how much sugar was added during processing or preparation. It is the
  fastest useful number to check on a modern Nutrition Facts label.
- **Fiber** is a useful sign that a carbohydrate food may be more filling and less refined.
- The serving size still matters. A small-looking number can become a large intake when someone
  eats two, three, or four servings.

Food companies can put sugar and processed carbs behind a lot of friendlier names: cane sugar,
high-fructose corn syrup, corn syrup, glucose, dextrose, fructose, honey, molasses, syrup, and
fruit-juice concentrate. It still counts.

Do not let the front of the package make your decision. “No added sugar,” “natural,” “low fat,”
and “made with real fruit” are marketing claims, not proof that a product fits your target. Turn
the package over. Check the serving size, calories, total carbohydrate, added sugars, and fiber.

A product can show 0 g Added Sugars and still be a poor everyday choice if it is mostly refined
carbohydrate with little fiber and a lot of calories. The practical rule is: build most carbohydrate
intake from foods that help the meal do its job. Use packaged carbohydrate foods deliberately, not
because the front of the package made them sound healthy.

The guidance also gives customers a clear recovery rule:

> You messed up a meal. Fine. Do not turn one decision into a lost day or a lost weekend. Do not
> punish it by starving tomorrow. Do not wait for Monday. Your next meal is your next chance to get
> back on target. Make the next choice better and keep going.

One off-target meal does not ruin results. Repeating the same choice without correcting it does.

## Recommended V1 customer flow

### 1. Locked state

A customer without an eligible paid ownership sees a short, honest explanation that Your Nutrition
is available with an eligible paid program. No targets, demo targets, or implied health claims are
shown.

### 2. Welcome

An eligible customer lands on a short explanation of Protein First and sees a single action:
**Set up my starting targets**. The page makes clear that targets are a starting estimate, not a
prescription, and that the tool does not require food logging.

### 2a. Learn the basics

Your Nutrition includes a small secondary **Learn the basics** card that links to the public Gen X
Jumps Nutrition hub. It does not block setup, change saved targets, or become a second in-app
content library.

The app teaches the immediate rules. The website carries the deeper explanations and examples.
The first linked education priorities are calories and macros, reading a label without getting
fooled, building a normal eating day, recovering after an off-target meal, and protein after 50.

### 3. Starting-target setup

The setup asks these direct questions:

1. **What is your current fitness goal?**
   - Lose fat
   - Add lean muscle and lose fat
   - Add lean muscle
   - Maintain your results
2. **What do you want your body weight to do?**
   - Lose weight
   - Maintain my current weight
   - Add weight slowly
3. Current weight and, when weight is changing, goal weight.
4. Height, age, and sex.
5. **Outside of workouts, how active is your typical day?**
   - Mostly sitting
   - On my feet most of the day
   - Physically active work
6. **How are you training right now?**
   - Jump rope or conditioning
   - Strength training
   - Both
   - Not training right now

The calculator does not ask people to estimate workout calories, workout duration, or training
frequency. It does not use exercise-calorie eat-back logic.

**Add weight slowly is not a bulk.** It is available only alongside a lean-muscle goal and must
never be framed as permission to chase rapid scale gain or eat without a target. The intended
outcome is stronger, more muscular, and still lean. Some scale gain may occur, but the scale alone
does not determine success.

For a customer who wants to add lean muscle while losing fat, maintaining roughly the same body
weight is a valid outcome. In that case, changes in waist, strength, capability, and how clothes
fit matter alongside the scale. Nutrition reuses the existing weight and waist records rather than
creating another tracking system.

The final field labels, units, valid ranges, skip handling, and medical/safety copy depend on the
formula decision. This screen must not ship until those decisions are approved and tested.

### 4. Starting targets

The result shows:

- starting daily calories
- daily protein target
- daily carbohydrate target
- daily fat target
- a clear statement that these are starting targets, to be measured against real life and results
- a visible **What are these?** information control beside the targets

The **What are these?** control opens this concise explanation:

> Starting estimate, not medical nutrition advice. If you follow a medical diet or have been told
> to limit protein, work with a registered dietitian.

A registered dietitian is deliberately named here. The app does not present a physician as the
primary source of individualized nutrition guidance.

The customer-facing rule is: **These are your numbers for the whole day. Every meal counts.**
Targets apply all seven days. There is no weekend mode, cheat-day setting, exercise-calorie credit,
or carb cycling.

The result must not describe a higher scale number as success by itself. When the customer has a
lean-muscle goal, it points them back to the existing Progress experience for weight and waist
context rather than presenting scale change as the only score.

### 5. Normal Eating Day

The calculator asks:

- **On a typical weekday, which of these meals do you eat?**
  - Breakfast
  - Lunch
  - Dinner
  - Snacks
- **Which meal tends to be your biggest?**
  - Breakfast
  - Lunch
  - Dinner
  - They're about the same

The app starts with a recommended split based on the selected meal occasions and largest main
meal. A larger main meal receives a larger calorie and carbohydrate share.

The customer can then select **Adjust your day** and shape the split around how they actually eat.
For example, someone who prefers coffee and a small breakfast can give breakfast a smaller share
and move more of the day to lunch, dinner, or snacks/dessert. This changes the meal-by-meal
guidance only. It never changes the daily calorie or macro targets.

The adjustment uses one actual slider for each selected eating occasion, with a clear **Reset to
recommended split** action. The slider runs from a smaller to a larger share of the day. The app
shows the resulting percentage, calories, protein, carbohydrates, and fat directly beneath each
meal.

The sliders represent relative meal size. Customers never have to make four percentages add to
100%. When one slider moves, the app automatically recalculates every selected meal while keeping
the daily calorie and macro totals fixed.

The app does not provide separate sliders for calories, protein, carbohydrates, and fat. One meal
slider updates all four numbers together. If a customer makes breakfast very small, the app moves
that portion of the daily targets into the remaining meals. The recommended starting split still
teaches a more deliberate protein spread, but the customer can shape the day around how they
actually eat.

A customer may select only one meal. Nutrition does not require a minimum meal frequency or force
breakfast, lunch, dinner, or snacks. With one selected eating occasion, that meal receives the
whole daily allocation and no slider is shown because there is nothing else to rebalance. If the
customer also uses a shake, snack, or dessert, selecting Snacks creates a second eating occasion
and activates both sliders.

The one-meal result states the consequence directly: the full daily calorie and macro targets must
fit that eating occasion. It does not block the customer or pretend that a single-meal pattern is
the app's prescribed schedule.

The result teaches the customer how all four numbers operate across a day. It is not a rigid meal
schedule, a daily checklist, or a meal-by-meal food log.

### 6. Repeatable meal rotation

The customer is responsible for using labels, serving sizes, and basic nutrition information to
build meals they enjoy that fit each meal allocation. Basic foods with predictable numbers make
this easier, including lean meats, eggs, potatoes, rice, beans, vegetables, fruit, yogurt, and
other foods with clear package or standard nutrition information.

The practical recommendation is a small rotation rather than dietary novelty:

- one or two breakfasts
- one or two lunches
- up to three dinners
- a few snack options

The app does not calculate a customer's individual recipes or claim that a named meal fits their
numbers. A future saved-rotation interface, if used, stores only customer notes and names; it is
not a food database or food log.

**My Normal Day** gives customers one real example of how I keep meals simple and make a daily
target work. It is an example of the method, not a prescribed meal plan. Its exact foods, servings,
and macro totals require final source data and verification.

### My current example day - source pending label verification

Most of my meals stay the same when I want to lean out. I do not rebuild my whole diet. I remove
or reduce the parts adding extra calories while keeping the protein-centered structure and foods I
already like.

| Eating time | Maintenance version | Fat-loss version |
| --- | --- | --- |
| Breakfast | 1 cup egg whites, 3 whole eggs, 1/2 cup uncooked oatmeal, 5 g creatine | 1 cup egg whites, 3 whole eggs, 5 g creatine |
| Lunch | 1 banana and 25 g protein powder (1 scoop) | 1 banana and 25 g protein powder (1 scoop) |
| Dinner | 1 lb 99% lean ground chicken, 1/2 Japanese sweet potato, 1/2 can black beans, 1/2 can sweet peas, assorted hot sauces | 1 lb 99% lean ground chicken, 1/2 Japanese sweet potato, 1/2 can black beans, assorted hot sauces |
| Dessert | 50 g protein powder (2 scoops) | 50 g protein powder (2 scoops) |

This is how I use the method. It is not a command for you to eat the same foods I eat. Find foods
you like, check the labels and serving sizes, and make them fit your own targets.

Before publication, verify the exact product labels for protein powder and ground chicken, can
sizes and serving counts, and the measured sweet-potato portion. No inferred macro totals may be
shown.

### 7. Revisit and simple check-in

The main Your Nutrition page always lets the customer revisit the Protein First guidance, their
current targets, and their Normal Eating Day. Existing optional weight and waist history remains
the platform's measurement record; Nutrition must not create a second measurement system.

V1 gives manual, non-automatic review guidance: if results have stalled, first look at portions,
liquid calories, dressings, sauces, and other calorie-dense foods before tearing up the whole
approach. It does not score adherence, decide that
someone has stalled, change targets automatically, or create a target-history dashboard.

## Explicitly out of V1

- mandatory food logging or detailed daily macro tracking
- calorie or workout "eat back" calculations, carb cycling, or a weekend-calorie mode
- rigid meal plans, generated one-day/seven-day menus, or a large recipe library
- AI meal generation, food checker, grocery list, restaurant guidance, substitutions, or saved
  recipe system
- barcode scans or meal-photo analysis
- adherence scores, automatic progress analysis, automatic target changes, or target-history
  dashboards

## Decisions that remain open

These choices must be resolved before implementation begins:

1. **Calorie method:** calculation, goal and goal-weight handling, movement categories, rounding,
   floors, maximum deficit, and what the app says when an estimate is not appropriate. The
   slow-weight-gain branch must be deliberately conservative and must not become a bulk
   prescription.
2. **Input and safety presentation:** exact valid ranges, height-unit handling, and the final
   caution/stop copy.
3. **Meal-allocation math:** the exact default distribution, adjustment limits, automatic
   rebalance behavior, rounding, and protein-spread behavior for selected meal occasions.
4. **My Normal Day:** final foods, serving sizes, nutrition information, and approved copy.
5. **Saved rotation:** confirm that V1 launches with the meal-allocation plan and My Normal Day
   only, without stored customer meal notes.
6. **Manual review prompt:** the exact customer-facing wording and the point at which the app
   invites a customer to reassess portions and calorie-dense foods.

## Formula guardrail

No numerical calorie or protein logic is approved by this document.

The eventual calorie method must use a **responsible starting deficit**: enough to create a
meaningful fat-loss trend, but not so aggressive that it treats rapid scale loss as the goal or
makes normal eating, training, and recovery harder than necessary. It must not add assumed
workout calories when the app does not know how often or how long a customer actually trains.
Real weight, waist, and adherence data remain the check on the initial estimate.

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
