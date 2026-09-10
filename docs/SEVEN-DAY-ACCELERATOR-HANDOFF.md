# 7-Day completion to Accelerator

This checkpoint connects the completed 7-Day plan to the existing controlled Accelerator purchase and setup path. Real payments remain a separate launch gate: the Stripe integration still rejects live keys and live payment objects.

## Customer path

1. After Day 7 and all prior days are complete, See What's Next opens the saved plan hub.
2. The completed hub leads with recognition and the 28-Day next step. Restarting the 7-Day remains secondary and still requires the existing explicit confirmation.
3. A verified nonowner sees the $37 offer. An owner sees setup or access to their existing program instead. Unavailable ownership data shows a neutral program link, not a claim that the customer needs to buy.
4. The offer page waits for account availability. A recognized customer uses account-bound checkout only; blocked account checkout cannot fall back to guest checkout. The existing guest path remains available for guests under its separate control.
5. The existing signed Stripe verification and idempotent ownership transaction establish purchase access. The success screen links directly to setup for the returned entitlement and explains nutrition access from the main navigation.
6. Setup remains an explicit start action. Existing program-switch transactions preserve the completed 7-Day, and nutrition access follows active paid ownership rather than which program is currently being exercised.

The existing completion email links to the completed plan, so it reaches this same next-step screen. Its locked transactional copy and sending/consent rules aren't changed by this checkpoint.

## Verification boundary

Local tests cover account/guest routing, owner suppression, disabled controls, and the existing Stripe identity, provisioning, setup, and nutrition access contracts. Full local and GitHub release gates are required. A live signed-in end-to-end run from a completed 7-Day through a controlled test purchase, setup, and nutrition still requires the customer's authenticated session. Source tests don't establish payment receipt or customer acceptance. Legacy-session-only, mixed-identity, refund, and other scenario work remains separate; public sales aren't declared operational by this checkpoint.

## Member labels and pre-test follow-up

Member navigation, destination labels, Home cards, and destination buttons use
**My Programs**, **My Progress**, **My Nutrition**, and **My Account** consistently
on desktop and mobile. Conversational guidance keeps second-person language
(e.g. "Your next step" and "Your programs couldn't be loaded"). Descriptive
headlines aren't destination labels. Routes, ownership, and checkout behavior
aren't changed by this copy pass.

Todd reported Home showing Programs unavailable and Progress unavailable while
nutrition showed Not unlocked. The first two share `getMyPrograms`; they aren't
proof of missing ownership or erased progress. Read-only inspection confirmed
the queried measurement/enrollment/active-program/completion fields and
service-role SELECT grants. The available review browser is signed out, so the
reported account-specific failure hasn't been reproduced or declared repaired.
Before the signed-in purchase test, refresh Home in the existing account and
confirm these cards load. If they still fail, capture the failed request/error
in that authenticated session before changing account or access logic.
