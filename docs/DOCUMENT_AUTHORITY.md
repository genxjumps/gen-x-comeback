# Document Authority

This document defines which repository material may govern new Gen X Jumps app work.

## Authority order

When two sources disagree, use this order:

1. **`AGENTS.md`** - development, safety, migration, and release rules.
2. **`CURRENT_STATE.md`** - what is implemented, live, closed, active, and next today.
3. **Durable product contracts** - approved customer behavior that remains true across checkpoints.
4. **`APP-INFORMATION-ARCHITECTURE.md` and the approved design-system rules** - navigation,
   shared components, terminology, and app-wide presentation.
5. **Operational runbooks** - exact procedures for releases, migrations, recovery, staging, email,
   and refunds.
6. **Implementation plans and proposals** - sequencing guidance only. They cannot overrule current
   state or an approved contract.
7. **Checkpoint, handoff, audit, and release-evidence documents** - historical evidence only unless
   `CURRENT_STATE.md` explicitly names one as active.

The current source and tests outrank a stale status claim in documentation. A source/document
conflict must be reported and reconciled before behavior is changed.

## Required document status

Every new or materially revised project document must identify one of these roles near its title:

| Role          | Meaning                                                                                |
| ------------- | -------------------------------------------------------------------------------------- |
| Current       | Describes the project's present condition. Only `CURRENT_STATE.md` receives this role. |
| Contract      | Durable approved product behavior.                                                     |
| Design system | Shared interface rules and reusable presentation decisions.                            |
| Runbook       | Procedure for a controlled operational action.                                         |
| Proposal      | Unapproved or partially approved recommendation.                                       |
| Historical    | Completed checkpoint, investigation, handoff, or superseded plan.                      |
| Evidence      | Immutable record of a test, migration, deployment, or incident.                        |

A document labeled Proposal, Historical, or Evidence cannot silently become a current instruction.

## Conflict rules

- Never combine a proposed rule and an approved rule without labeling both.
- Never leave “next,” “pending,” “current,” or “remaining” language inside a completed checkpoint
  and expect it to remain authoritative.
- Never treat a PR number, old SHA, test count, deployment ID, or migration status as current unless
  it is also recorded in `CURRENT_STATE.md`.
- Never infer current behavior from the default GitHub branch while `CURRENT_STATE.md` names a
  different integration branch.
- Never copy an old checkpoint into a new document without removing superseded status claims.
- Never use a historical incident plan as the active development plan.

## Product state, review scenario, and release state

Use these terms distinctly:

- **Product state** - stored customer or program behavior such as Not Started, Active, Paused, or
  Completed.
- **Access state** - whether a workout or feature is current, locked, completed, or unavailable.
- **View condition** - loading, empty, error, confirmation, or other UI rendering condition.
- **Review scenario** - fixed fake data used to inspect a view. It is not a product state.
- **Release state** - source-only, migrated, configured, published, verified, or live.

Do not use the generic word “state” when one of these more precise terms is available.

## Historical preservation

Historical material remains available through Git history and the preservation branch
`archive/pre-reset-2026-09-17`. Moving material into a historical location does not authorize
deleting its branch, closing its PR, or discarding unique commits.

## Change discipline

- Update durable contracts only when Todd approves a product-behavior change.
- Update the design system when an app-wide visual decision is approved.
- Update `CURRENT_STATE.md` when present reality changes.
- Record tests, deployments, migrations, and incidents as dated evidence.
- Put unresolved work in a GitHub issue or a clearly labeled proposal, not inside a current contract.
