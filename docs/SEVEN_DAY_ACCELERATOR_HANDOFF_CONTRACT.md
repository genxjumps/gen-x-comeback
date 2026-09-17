# 7-Day to Accelerator Handoff Contract

**Role:** Contract

This contract defines the durable transition from the completed free plan to the paid Accelerator.
Checkpoint and deployment history is preserved in
[`history/SEVEN-DAY-ACCELERATOR-HANDOFF.md`](history/SEVEN-DAY-ACCELERATOR-HANDOFF.md).

## Customer path

1. After all seven free-plan days are complete, the saved plan hub recognizes completion and makes
   the Accelerator the primary next step. Restarting the free plan remains secondary and explicit.
2. A verified non-owner sees the `$37` one-time offer. An owner sees the correct setup, continue, or
   repeat action instead of another purchase pitch.
3. Account availability must resolve before an account-bound checkout is offered. A failed account
   lookup cannot silently fall back to guest checkout.
4. Signed Stripe verification and the idempotent ownership transaction establish access. Purchase
   creates ownership but does not start Day 1.
5. The post-purchase screen confirms ownership and links to Accelerator setup. Setup is the explicit
   program-start action.
6. The completed 7-Day Plan and all of its progress remain saved after purchase and program start.
7. Nutrition unlocks from qualifying paid ownership, independently of which program run is active.

## Messaging and navigation

- Member navigation uses Home, Programs, Progress, and Nutrition. Account and Notifications remain
  persistent utilities.
- The completion email links back to the completed plan so the customer reaches the same
  ownership-aware next step.
- A purchase still being confirmed says payment was received and offers a retry. It must never
  imply that the customer should pay again.
- The completed state uses **You Own It** and leads to setup without claiming Day 1 has started.

## Release boundary

Source support for test checkout does not authorize live keys, real payments, public purchase
links, public enrollment, provider configuration, migration execution, or publication. Each
external action retains its separate approval and verification gate.
