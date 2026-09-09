# 7-Day signup recovery checkpoint

## Scope and approval

Base: GitHub `release/v1.1` at `9086c4ee3760b32ec415502553ecc7bdded2329f`.
Todd approved bounded implementation after read-only inspection, including
same-browser-only draft resume and secure, explicit completed-plan restart.
Migration application, merge, deployment, secrets, and public admission are not authorized.

## Repair

`commit_plan_version` serializes normalized-email saves and submission retries.
Email-only existing-identity submissions return `existing` without granting access
or replacing a plan. The forward definition pins PL/pgSQL column resolution to
remove collisions between output parameters and column references in the existing
replacement body. Completed plans also reject ordinary reassessment at the
transaction boundary; only the dedicated restart transaction supplies restart intent.

`save_signup_plan` atomically commits the plan, calendar, intake completion, and
controlled Plan Ready scope. Session establishment after commit is retryable; the
saved submission and its emails are never duplicated if the HTTP response is lost.

The welcome outbox is created by the intake insert transaction. Dispatch uses a
separate credential from the unsigned-in browser handoff. Signed provider events
reconcile both before and after the welcome job learns its provider message ID.
Bounce and complaint suppression applies to future sends without removing access.

No linked database was used for implementation tests. No provider email was sent.

The existing version-change trigger reactivates both consent flags. The dedicated
restart transaction restores all prior plan and marketing preference fields before
commit, so this new restart action does not silently opt the participant back in.
Ordinary signup and the existing reassessment consent rule remain unchanged.

## Verification

Local `bun run verify` passed on September 9, 2026: 766 tests in 77 files,
isolated database acceptance and security checks, typecheck, lint, formatting,
and production build. GitHub CI must independently pass on the review commit.

- `bun run test`: unit and contract coverage, including same-browser draft ownership,
  first unfinished step, fresh-device behavior, existing-plan authorization,
  current-state welcome routing, failed member bridge, and stable welcome payloads.
- `bun run signup:db:test`: replays all application migrations in isolated WASM
  PostgreSQL and executes `supabase/signup-recovery.acceptance.sql`. It covers
  rollback on invalid calendar, exact save retry, repeat signup with different
  answers, unchanged identity/progress, email-only access rejection, reusable
  email proof, independent browser sessions, explicit restart and retry, stale
  restart rejection, preserved completed history, current-state old welcome links,
  expiry, operational controls, suppression, shared capacity, and lease fencing.
- Email advisory locks and submission locks serialize competing saves. The isolated
  engine executes sequential SQL; an actual simultaneous multi-client race remains
  part of staging verification.
- The isolated harness supplies Supabase roles, an empty auth user table, an empty
  migration ledger, and inert Vault/cron/net schemas. It skips only installation of
  `pg_cron` and `pg_net`. It does not exercise network delivery, the deployed
  scheduler, full Supabase Auth, or browser cookie transport.
- `bun run signup:db:types` deterministically derives the additive signup table row
  types from the replayed schema. The regular database test checks those bytes.
  It does not rewrite unrelated historical generated types.
- Database security lint checks the new functions' security-definer mode, fixed
  search path, and denied anonymous/authenticated execution. This is not a full
  `supabase db lint` or a production dry run.
- Full repository gate remains `bun run verify`; it now includes the isolated
  signup database checks. Existing locked migration files remain unchanged.

## Separate release steps

1. Review this complete PR and green Quality Gate.
2. Obtain merge approval, merge the exact reviewed head, and verify the independent
   post-merge Quality Gate.
3. Follow `DATABASE-MIGRATION-PROCESS.md`: staging parity, fresh read-only linked
   history/schema comparison, database linting, and the production CLI dry run.
4. Obtain explicit migration approval and apply only
   `20260909190000_seven_day_signup_recovery.sql` through that workflow.
5. Obtain publication approval, run the normal release preflight, publish once,
   and verify the exact production identity.
6. Keep intake closed. Obtain approval for controlled email/browser tests before
   creating live test data or sending mail.
7. Public intake requires its own later approval.

## Controlled live acceptance still required

Use only approved test identities. Test same-browser abandonment after each stage;
open the welcome link in a clean second browser; repeat signup for an incomplete
and a completed plan; verify explicit restart separately; simulate a lost save
response and simultaneous tabs. Confirm welcome delivery before setup, separate
Plan Ready after save, safe expiry recovery, and no changes to plan/marketing
preferences from merely opening a link. Verify iPhone Safari cookie transport and
Home Screen access through the accepted app navigation. Confirm the production
sending gate, genuine-plan exclusion, and provider ceiling remain unchanged.
