# Gen X Jumps App

Mobile-first Gen X Jumps PWA for the free personalized 7-Day Plan and the $37 one-time 28-Day Fat
Loss Accelerator.

The repository and Lovable project retain the historical working slug `Gen X Comeback`. That slug
is not the public product name.

## Start here

Read these before changing the project:

1. [`AGENTS.md`](AGENTS.md) - safety, development, migration, and release rules.
2. [`CURRENT_STATE.md`](CURRENT_STATE.md) - the only current-status source.
3. [`docs/DOCUMENT_AUTHORITY.md`](docs/DOCUMENT_AUTHORITY.md) - which documents govern when
   sources disagree.
4. The durable product contract or runbook relevant to the bounded checkpoint.

Current cross-cutting records:

- [`docs/APP-INFORMATION-ARCHITECTURE.md`](docs/APP-INFORMATION-ARCHITECTURE.md)
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)
- [`docs/ACCOUNT_ACCESS_CONTRACT.md`](docs/ACCOUNT_ACCESS_CONTRACT.md)
- [`docs/NUTRITION_CONTRACT.md`](docs/NUTRITION_CONTRACT.md)
- [`docs/SEVEN_DAY_ACCELERATOR_HANDOFF_CONTRACT.md`](docs/SEVEN_DAY_ACCELERATOR_HANDOFF_CONTRACT.md)

The September 17 preservation inventory is recorded in
[`docs/release-evidence/2026-09-17-project-reset-inventory.md`](docs/release-evidence/2026-09-17-project-reset-inventory.md).

## Current source boundary

- GitHub is authoritative.
- `release/v1.1` is the active V1.1 integration source.
- `main` is protected but stale and pending reconciliation.
- New work begins from the exact current `release/v1.1` head on one bounded `agent/<checkpoint>`
  branch.
- Run `bun run verify` before requesting merge. GitHub CI must pass.
- Lovable is used for controlled review and explicitly approved publication, not routine source
  editing.

See [`CURRENT_STATE.md`](CURRENT_STATE.md) for audited SHAs, live-vs-source identity, implemented
scope, operating gates, and the active checkpoint.

## Locked product foundation

- Free personalized 7-Day Plan with saved sequential progression and recovery.
- Passwordless portable return access.
- Permanent customer-account ownership of paid programs.
- $37 one-time 28-Day Fat Loss Accelerator ownership with a seven-day refund-request window.
- Purchase and program start remain separate.
- Repeatable versioned runs with Not Started, Active, Paused, and Completed behavior.
- Sequential 28-day progression without missed-day skipping or expiration.
- Optional weight and waist history.
- Account-level Nutrition access for qualifying paid ownership, independent of workout progression.
- Home, Programs, Progress, and Nutrition as permanent member navigation, with Account and
  Notifications as persistent utilities.

Detailed behavior remains governed by the relevant durable product contracts, not by old checkpoint
status text.

## Current operating gates

The app remains pre-launch. Public intake, live payment processing, genuine-customer paid enrollment,
broad customer email, migration application, provider changes, and production publication remain
controlled operations requiring their existing approvals.

## Verification

The project uses Bun 1.3.8.

```sh
bun install --frozen-lockfile
bun run verify
```

The complete gate runs migration integrity, Vitest, isolated database contract tests, TypeScript,
ESLint, Prettier, and the production build.

After changing a tracked build input under `.env`, root build configuration, `public/`,
`scripts/`, `src/`, or `supabase/`, run:

```sh
bun run release:manifest
bun run verify
```

Documentation-only changes do not require a release-manifest rewrite.

## Main technology

- React 19
- TypeScript
- TanStack Start and Router
- Tailwind CSS 4
- Lovable Cloud / Supabase-compatible backend
- Stripe test checkout
- Resend email transport
- Vitest
- Bun 1.3.8

## Preservation rule

Do not delete stale branches, close stale pull requests, rewrite history, or discard old documents
merely because they appear superseded. First prove whether their commits are reachable from the
current release or preserved by an explicit archive. The September 17 reset begins with inventory
and authority cleanup only.
