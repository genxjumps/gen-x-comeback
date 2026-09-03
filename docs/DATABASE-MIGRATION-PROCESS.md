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

## Current database-history audit

The September 3, 2026 read-only audit found 27 canonical Git migrations and 25 rows in `supabase_migrations.schema_migrations`.

- The first 23 canonical versions through `20260807193000` are present under the same versions and names. Twenty-two retain stored SQL whose digest matches the locked Git file exactly or after removing one final newline.
- `20260807193000_4d5f0f64-0a61-4ee4-bf12-3a1f3d50f92e` has the correct canonical version/name but an empty stored statement array. Its history row identifies the controlled production soft-launch operation that recorded it, so its schema must be reverified semantically rather than by stored-statement digest before reconciliation.
- Supabase records `20260902143723_09bfcd48-c94a-4b51-b570-eb9134b8405e` instead of canonical `20260828170000_customer_account_foundation`.
- Supabase records `20260902144059_8e2af25a-3148-4369-ae16-652db6eb9349` instead of canonical `20260828180000_accelerator_enrollment_progress`.
- The stored statement SHA-256 values for those two Supabase rows are respectively `f90fee89d873658b498bb84bf4edefac61135bddf6a3f98dc584c7db15c9c660` and `38506c0a1598da9a50d1943e9e42188ba508a8a213240495437ec6c4f7910148`. They exactly match the canonical files' statement digests. The filenames differ because Lovable created duplicate timestamped copies that were later removed from Git.
- Canonical `20260828150000_mailerlite_marketing_sync` and `20260902183000_recovery_transactional_claim_contract` are not recorded in the remote history table. Read-only checks confirmed their primary tables/functions exist in the current database, but the remote history still requires controlled reconciliation.

This audit explains the mismatch. It does not authorize changing the production migration table or applying migration SQL.

## One-time history reconciliation

The history repair is a separate production operation and requires Todd's explicit approval at the action boundary. It must not be bundled into an application deploy.

Before repair:

1. Use a clean checkout of the exact green `release/v1.1` SHA.
2. Confirm `bun run migration:check` passes.
3. Capture a fresh read-only export of every remote migration version, name, stored statement digest, and statement count.
4. Reconfirm the two alias digests above and verify the required marketing-sync and recovery objects/functions against the canonical migrations.
5. Confirm the linked Supabase project reference is exactly `wrvjgjvdjjoytjdwntlx` without printing credentials.
6. Record the current history as the rollback boundary.

The intended repair changes only `supabase_migrations.schema_migrations`; it does not execute or reverse application-schema SQL:

```sh
supabase migration repair 20260902143723 --status reverted
supabase migration repair 20260902144059 --status reverted
supabase migration repair 20260828150000 --status applied
supabase migration repair 20260828170000 --status applied
supabase migration repair 20260828180000 --status applied
supabase migration repair 20260902183000 --status applied
```

Run one command at a time and inspect the migration list after every command. Stop on any unexpected output. Do not run `db push` during the repair.

After repair:

1. `supabase migration list --linked` must show all 27 canonical Git versions and no alias-only versions.
2. `supabase db push --linked --dry-run` must report no pending migrations.
3. Repeat the schema/object verification for customer identity, Accelerator, marketing sync, and transactional recovery.
4. Confirm recovery access and production email controls remain unchanged.
5. Record the exact release SHA, before/after migration lists, commands, timestamps, and verification results.

If any post-repair check fails, stop. Reverse only the history-record changes using the opposite `migration repair` statuses. Do not delete application data or run down migrations.

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
