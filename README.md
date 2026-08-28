# Gen X Jumps App

Mobile-first Gen X Jumps PWA for the free personalized 7-Day Plan and the upcoming 28-Day Fat Loss Accelerator.

The repository and Lovable project still use the historical working name `Gen X Comeback`. That is a project slug, not a locked public product title.

## Current status

The app is **pre-launch and still in development**. There are no real external users or live paid customers using it yet.

New public plan intake is closed in source during pre-launch. Existing participants can still use
their saved access or request a recovery link. Reopening intake requires a reviewed source change
and release.

The free 7-Day Plan is the accepted functional baseline. The paid 28-Day Accelerator is the active
next development phase. Its product contract, deterministic sequence, private paid-domain data
model, saved sequential progress, and weekly check-in foundation now exist in source. Checkout,
public enrollment, paid email, and the public offer remain unimplemented.

`main` and `release/v1.1` are kept aligned as the accepted pre-launch baseline before new V1.1 checkpoints begin.

## What currently works

- Mobile-first entry experience
- Multi-step fitness assessment
- Personalized 3-, 4-, 5-, and 7-workout schedules
- Results preview before lead capture
- Lead, consent, assessment, and plan persistence
- Day 1 through Day 7 assignment flow
- Server-enforced sequential completion
- Saved-plan return access
- Passwordless secure return links
- Public recovery flow
- All seven workout videos
- Plan progress and completion behavior
- Six proactive free-plan lifecycle emails: Plan Ready, Start Day 1, Halfway, Stalled, Final Rescue, and Plan Completed
- User-requested recovery email
- Resend delivery integration and signed webhook reconciliation
- Production-capable scheduler and email safeguards
- Direct MailerLite subscriber sync foundation for marketing-consented leads
- PWA manifest and installable-app foundation
- Current Gen X Jumps V1 visual system
- Source-level verified customer-account and legacy-plan linking foundation; migration unapplied
- Account-owned Accelerator purchase and permanent-entitlement foundation; migration unapplied
- Repeatable, versioned program runs with one active structured run per account
- Not Started ownership plus Active, Paused, and Completed run behavior
- Server-enforced Day 1 through Day 28 completion and resume behavior
- Saved weekly weight, waist, and optional progress notes

The existing email and scheduler infrastructure has been heavily staged and verified, but that does **not** mean the overall product has launched to customers.

## Verification baseline

The repository uses Bun 1.3.8 and one complete verification command:

```sh
bun run verify
```

That command runs:

- Vitest
- TypeScript
- ESLint
- Prettier check
- Production build

The current regression count is reported by Vitest during `bun run verify`; that command is the
authoritative quality gate rather than a manually maintained test total in this README.

GitHub Actions runs the same quality gate for changes targeting `main` or `release/v1.1`.

## Development workflow

The development order is:

**ChatGPT / coding agent -> GitHub -> Lovable**

GitHub is the source of truth. Lovable is used later for controlled visual/interaction review and publication, not as the default coding environment.

Branch roles:

- `main` - accepted pre-launch baseline
- `release/v1.1` - V1.1 integration branch
- `agent/<checkpoint>` - one bounded development checkpoint

New work should begin from the current `release/v1.1` head, pass `bun run verify`, and reach `release/v1.1` through a pull request.

See [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) and [`AGENTS.md`](AGENTS.md) for the working rules.

## Backend during pre-launch development

Because there are no real external users yet, the current Lovable/Supabase backend remains the development backend for now.

A separate staging backend is **not required** just to continue V1.1 development. Revisit that decision before public launch, or earlier if a particular checkpoint introduces enough operating risk to justify isolation.

Development rules still apply:

- Use clearly identifiable test data.
- Keep secrets and local `.env` files out of Git.
- Keep schema changes in version-controlled forward-only migrations.
- Keep real-money and test payment behavior separated when Stripe is added.
- Keep outbound email testing bounded to intended recipients.
- Review and clean test state before public launch.

## MailerLite lead sync

The app has a direct, no-Zapier MailerLite sync path. It uses the existing five-minute scheduler,
but has its own fail-closed environment gate. The published app calls a service-role-authenticated
Cloud Edge Function for the provider request because McLovable project secrets are available there
at runtime. It does not depend on Resend sending being enabled.

Only a future activation of `marketing_consent_active` creates a durable sync job. Publishing the
migration does not backfill existing participants. The provider payload contains only:

- Normalized email address
- First name
- Marketing-consent timestamp
- The configured MailerLite group ID

Assessment answers, weight, protein targets, plan details, and progress are never sent to
MailerLite. The integration never sets MailerLite's `resubscribe` flag, so it cannot reactivate a
contact MailerLite already marks unsubscribed, bounced, or junk.

Activation requires all three Edge Function project secrets:

- `MARKETING_SYNC_ENABLED=true`
- `MAILERLITE_API_TOKEN`
- `MAILERLITE_GROUP_ID`

After changing a McLovable project secret, publish a fresh project version before expecting the
new value to exist in the live runtime. Preview receives project-secret changes immediately.

Before enabling it, confirm the selected MailerLite group and review any automation attached to
that group. MailerLite group assignment can itself trigger a campaign automation.

## Local development

Bun 1.3.8 is the locked runtime.

```sh
git clone https://github.com/genxjumps/gen-x-comeback.git
cd gen-x-comeback
cp .env.example .env
bun install --frozen-lockfile
bun run dev
```

Before opening or merging a pull request:

```sh
bun run verify
```

## Main technology

- React 19
- TypeScript
- TanStack Start / Router
- Tailwind CSS 4
- Lovable Cloud / Supabase-compatible backend
- Resend for email transport
- Vitest
- Bun 1.3.8

## Next development phase

Resume V1.1 from a fresh bounded branch created from `release/v1.1`.

The expanded Accelerator experience is governed by
[`docs/V1_1_28_DAY_PRODUCT_CONTRACT.md`](docs/V1_1_28_DAY_PRODUCT_CONTRACT.md). PR #16's private
foundation is documented in
[`docs/V1_1_28_DAY_DATA_FOUNDATION.md`](docs/V1_1_28_DAY_DATA_FOUNDATION.md), but its migration
remains unapplied and requires reconciliation with the expanded contract before use.

The read-only foundation gap audit is complete. The dependency-based build sequence and GitHub
Actions discipline are recorded in
[`docs/V1_1_ACCELERATOR_IMPLEMENTATION_PLAN.md`](docs/V1_1_ACCELERATOR_IMPLEMENTATION_PLAN.md).
The unified customer-account, ownership/program-run, and program-progress corrections are complete
at source level. Customer-local next-day unlocking, missed-day persistence, bounded Undo,
completed-day reopening, separate video views, and safe 7-Day Plan switching are represented and
tested. Both migrations remain unapplied and every public entry point remains closed.

The next checkpoint is independent optional weight and waist history with safe corrections,
removals, and run-specific starting, newest, and final values. Later checkpoints may apply and
verify the corrected migration chain inside a controlled development boundary, audit real workout
and coaching assets, approve nutrition formulas, and add a tested checkout handoff. Public
enrollment remains fail-closed throughout that work.

## Historical implementation evidence

Detailed email-staging, migration, scheduler, and production-safety evidence previously stored in this README remains preserved in Git history and the governing project documentation. It was removed from the README so this file can serve as a clean current-state entry point for development.
