# Database Migration Process

Git migration files and Supabase's remote migration-history table are one control system. Neither is sufficient by itself. A schema change is approved only when the reviewed Git file, its locked digest, the remote history row, and the resulting schema agree.

## Repository controls

Every SQL file under `supabase/migrations/` is recorded in `supabase/migration-lock.json` with:

- Its canonical filename, version, and name.
- A byte-exact SHA-256 digest.
- A statement SHA-256 digest that ignores one final newline so it can be compared with Supabase's stored migration statement.

`bun run migration:check` fails when a file is missing, renamed, modified, malformed, duplicated, or inconsistent with the lock. In CI it also compares the branch with its Git base and allows only new migration files. Existing migration SQL and existing lock entries are immutable.

After adding and reviewing a strictly newer migration, run:

```sh
bun run migration:lock
bun run release:manifest
bun run verify
```

`migration:lock` refuses to bless a changed or deleted historical file. It only appends previously unseen migrations whose versions sort after the locked history.

## Reconciled production history

The September 3, 2026 audit initially found 27 canonical Git migrations and 25 remote history rows. Two Lovable-created alias versions were present, and four canonical versions were absent. The audit also found one older canonical history row with no stored SQL.

Todd explicitly approved the history-only repair. The repair completed at `2026-09-03T23:54:28Z` against release SHA `3ca0a40c73270d328ec9b6ec6c307247dcf90dee`, after Quality Gate run `33818713755` passed on that exact SHA.

The reconciled production state is:

- Remote history contains exactly 27 versions and names, matching every entry in `supabase/migration-lock.json` with no missing or extra versions.
- Alias-only versions `20260902143723` and `20260902144059` are absent.
- Canonical versions `20260828150000`, `20260828170000`, `20260828180000`, and `20260902183000` are present with the exact locked names and SQL statement digests.
- Every other stored SQL digest matches the locked Git file exactly or after removing one final newline.
- `20260807193000_4d5f0f64-0a61-4ee4-bf12-3a1f3d50f92e` remains the one legacy row with an empty stored statement array. Its complete production object set was verified semantically against the canonical migration.
- Post-repair checks found all 15 expected protected tables, 36 functions, 16 indexes, and 2 triggers. All 15 tables have RLS and the expected service-role policy. All 36 functions match their intended security mode, fixed search path, and execute permissions.
- The recovery claim and provider-attempt functions retain the transactional recovery-consent bypass, proactive Plan-email consent fence, hard-bounce/complaint suppression, production sending gate, controlled-plan scope, and provider limit. Neither function consults marketing consent.
- Production email controls remained `sending_enabled=true`, `genuine_plans_admitted=false`, `provider_submission_limit=10`, with the controlled test plan configured.

No application-schema SQL was executed during this repair. The evidence is recorded in [`release-evidence/2026-09-03-migration-history-reconciliation.md`](release-evidence/2026-09-03-migration-history-reconciliation.md).

## Completed one-time history reconciliation

This history repair was a separate production operation with Todd's explicit approval. It was not bundled into an application deploy.

Before repair:

1. Use a clean checkout of the exact green `release/v1.1` SHA.
2. Confirm `bun run migration:check` passes.
3. Capture a fresh read-only export of every remote migration version, name, stored statement digest, and statement count.
4. Reconfirm the two alias digests above and verify the required marketing-sync and recovery objects/functions against the canonical migrations.
5. Confirm the linked Supabase project reference is exactly `wrvjgjvdjjoytjdwntlx` without printing credentials.
6. Record the current history as the rollback boundary.

The approved repair changed only `supabase_migrations.schema_migrations`; it did not execute or reverse application-schema SQL:

```sh
supabase migration repair 20260902143723 --status reverted
supabase migration repair 20260902144059 --status reverted
supabase migration repair 20260828150000 --status applied
supabase migration repair 20260828170000 --status applied
supabase migration repair 20260828180000 --status applied
supabase migration repair 20260902183000 --status applied
```

Each equivalent history operation was run separately through the authorized production database connection, using Supabase CLI's documented `DELETE` and `UPSERT` semantics. The remote migration list was inspected after every operation. No `db push` was run during the repair.

Completed verification:

1. An exact remote-ledger comparison showed all 27 canonical Git versions and no alias-only versions.
2. The exact remote-versus-lock comparison found no pending, missing, or extra migration versions.
3. Schema/object verification passed for customer identity, Accelerator, marketing sync, production email control, and transactional recovery.
4. Recovery logic and production email controls remained unchanged.
5. The exact release SHA, before/after state, operations, timestamp, and verification results were recorded.

The execution environment did not contain the Supabase CLI or a Supabase database credential, so a literal `supabase db push --linked --dry-run` command could not run there. The authorized database comparison proved the same pending-version set directly. This one-time exception does not waive the CLI dry-run requirement for future production schema changes.

If a future audit disputes this reconciliation, stop. Reverse only the history-record changes using the opposite `migration repair` statuses after a new explicit approval. Do not delete application data or run down migrations.

## Normal forward migration workflow

1. Create one new migration from the current release branch with a version later than every locked migration.
2. Keep the change forward-compatible. Use expand/migrate/contract across separate releases when removing or changing data used by the running app.
3. Test a complete replay against an isolated database and run database linting.
4. Regenerate Supabase types deterministically and review the behavioral diff separately from formatting.
5. Run `migration:lock`, `release:manifest`, and the complete Quality Gate.
6. Merge only the exact green PR head and wait for the post-merge gate.
7. Apply migrations to staging first and run affected end-to-end tests.
8. From the exact approved release checkout, run `supabase db push --linked --dry-run` against production and record the pending versions.
9. After explicit production approval, apply the expected migration once.
10. Verify remote history, schema behavior, generated types, operational controls, and the application smoke test before publishing dependent application code.

Never edit the live schema through Lovable, the Supabase dashboard, or an ad hoc query once this migration path is active. Emergency repairs use a reviewed forward migration unless changing the history table alone is the verified repair.

## Supabase references

- [Database migration deployment workflow](https://supabase.com/docs/guides/deployment/database-migrations)
- [CLI reference for migration repair and db push dry runs](https://supabase.com/docs/reference/cli/introduction)
- [Managing separate environments](https://supabase.com/docs/guides/deployment/managing-environments)
