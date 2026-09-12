# Gen X Jumps App Information Architecture

This document defines the customer-facing app buckets, navigation and copy responsibilities. It
does not change route authorization, payment controls, public intake or program ownership.

## Permanent member navigation

The authenticated desktop and mobile navigation contains four destinations:

1. **Home** - what the participant should do today.
2. **Programs** - owned, active, paused, completed and available programs.
3. **Progress** - program completion, weight, waist and history.
4. **Nutrition** - current calorie and macro targets, meal distribution and guidance.

Account and Notifications remain persistent header actions. Available programs are part of
Programs, so Explore is not a separate permanent navigation destination. The legacy `/programs`
route redirects to the Available Programs section of `/my-programs`.

## Customer route map

| Bucket                    | Routes                                                                                                                                                          | Navigation rule                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Public entry and setup    | `/`, `/welcome`, `/assessment/start`, `/assessment`, `/assessment/complete`, `/plan-ready`, `/preview/w01`, `/recover`, `/return`, `/signup/return`             | Flow steps, never permanent member navigation                                                   |
| Home                      | `/home`                                                                                                                                                         | Permanent navigation                                                                            |
| Programs                  | `/my-programs`, `/your-plan`, `/your-plan/day/:day`, `/accelerator`, `/my-programs/accelerator/setup`, `/my-programs/accelerator/runs`, `/programs/accelerator` | Programs is permanent; plan, workout, setup, history and offer pages are contextual drill-downs |
| Progress                  | `/progress`                                                                                                                                                     | Permanent navigation                                                                            |
| Nutrition                 | `/nutrition`                                                                                                                                                    | Permanent navigation for eligible accounts; locked state remains informative                    |
| Account and alerts        | `/account`, `/account#purchases`, `/notifications`                                                                                                              | Persistent header actions, not bottom navigation                                                |
| Transitions and utilities | `/checkout/accelerator/success`, email preference and secure-return routes                                                                                      | Contextual only                                                                                 |
| Internal                  | `/admin/*`, `/preview/accelerator`, `/api/*`                                                                                                                    | Never customer navigation                                                                       |

Jump-rope recommendations are contextual guidance from a plan or workout. They do not receive a
permanent navigation position unless a future Resources product bucket is separately approved.

## Copy responsibilities

- Home answers **What is my workout today?** It may summarize Programs, Progress and Nutrition but
  does not duplicate their full content.
- Programs answers **What do I own, where did I stop and what can I do next?**
- Progress answers **What work and results have added up?**
- Nutrition answers **What are my current targets and how do I use them?**
- Account handles identity, purchases, refunds and access controls.
- Notifications contain useful optional actions and never change progress or saved targets.

Customer-facing copy uses **workout**, not **assignment**. Navigation uses **Programs**,
**Progress** and **Nutrition**. Page headlines may use conversational second-person language such
as **Your Programs** or **Your Progress**.

## Protein target ownership and weight review

- The 7-Day protein target is calculated from the assessment weight and stays fixed for that saved
  plan. Completing or revisiting the plan does not rewrite it.
- After paid Nutrition setup, the saved Nutrition profile is the current account-level source of
  truth shown on Home and Nutrition.
- Waist is a progress measurement and never changes a protein or calorie target.
- A newer weight does not silently change saved Nutrition targets. When weight has changed by at
  least 5 lb and the rounded calorie or macro calculation changes, Notifications and Nutrition
  invite the participant to review the proposed numbers.
- The review shows current and proposed calorie and protein targets. Targets change only after the
  participant opens the Nutrition form and explicitly saves the recalculation.
