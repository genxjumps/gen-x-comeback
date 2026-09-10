# Controlled account recovery migration

Status: proposed for Todd's explicit adoption. His migration and deployment approval
is already recorded in the session; adopting this procedure supplies the missing
execution method. It doesn't authorize future migrations or opening intake.

## Exact scope

Only `20260910170000_account_recovery_without_ownership.sql`, merged in PR #103,
may use this procedure on Lovable project `9882f922-c17b-4fca-bd5b-48b9548e5322`,
Supabase reference `wrvjgjvdjjoytjdwntlx`.

- SQL byte SHA-256: `91b3e22b73019ea7e82dd9cca666819ec31ab88c0a50846f6077a94a9845f7a6`.
- SQL statement SHA-256: `e52d26d17c4401cebca48b1912e7a1da47990fc9d36fe286cd706d4defbef6d7`.
- Implementation release: `a60cf0be6a92b26a780badcb75680b7c7fbbdd17`.
- Independent post-merge Quality Gate: [34507648811](https://github.com/genxjumps/gen-x-comeback/actions/runs/34507648811).

This uses the same narrowly scoped pre-launch substitutions adopted for the
earlier refund migrations: exact ledger/schema comparison instead of an
authenticated Supabase CLI dry run; authenticated Lovable SQL transport instead
of CLI application; full isolated PostgreSQL replay, clean/hosted permission
validation and deterministic changed-column types instead of separate staging,
Supabase lint and full type generation. No CLI connection is configured here.
The normal process resumes for every other migration. These checks don't prove
hosted Auth, email delivery or browser behavior; controlled post-deploy testing
remains necessary. A staging boundary is still required before public launch.

## Completed preflight and rehearsal

GitHub and Lovable source matched the implementation release. Hosted PostgreSQL
17.6 runs as the expected migration role. The enabled database has 40 history rows,
with exactly this one pending version. Names and locked digests match, retaining
only the two already documented historical exceptions: the empty statement array
at 20260807193000 and the exact leading-newline digest at 20260904110000.
No history repair is included.

All 308 inspected schema records matched the canonical pre-migration replay under
the 100 observed default-privilege records. The comparison includes public
application function bodies/security, the ten purchase/account/refund dependency
tables, columns, constraints, indexes, policies and triggers. NOT NULL catalog
objects are compared via column nullability across PostgreSQL versions.

Sending was enabled, paid sending was enabled, provider limit was 25, genuine
plan admission was false and paid-customer admission was true. No non-test Stripe
purchase references were found. These are historical observations; recheck them
before execution. No live database or operational setting was changed.

The [reviewed transaction](release-evidence/account-recovery-application.sql)
contains the exact Git migration bytes and a plain canonical history INSERT.
Its SHA-256 is `42c04e7e682a4c8cb7b6afe8d499cacf36841deb8fecfe887ab80b62051c2d0c`.
The [rehearsal evidence](release-evidence/account-recovery-preflight.json) records:

- Canonical baseline and hosted defaults matched.
- A forced failure after the DDL and history INSERT rolled back all changes,
  including the temporary sending pause.
- Successful execution produced exactly 41 history rows and the expected schema.
- A second application was rejected by the ledger assertion without changing state.
- Existing refund permissions and behavioral acceptance passed.
- Account recovery acceptance passed without restoring refunded ownership.

## Execution under the existing approval, after adoption

1. Use the clean current release containing this adopted procedure, with a green
   independent post-merge Quality Gate and matching Lovable source. Verify the
   unchanged migration and transaction digests. Don't publish yet.
2. Refresh the ledger, schema, defaults, operational controls and pre-launch checks.
   Require the exact captured baseline. On drift, stop and investigate; don't
   weaken assertions. Confirm no paid worker has an active processing lease.
3. Prove authenticated SQL transport atomicity using a temporary-table rollback
   probe that leaves no persistent state, as in the prior refund procedure.
4. Execute the reviewed transaction exactly once. It takes advisory and ledger
   locks, uses bounded timeouts, verifies baseline state, and atomically pauses
   paid-access sending before applying the migration. Any failure rolls back the
   pause along with the schema/history changes. It verifies resulting schema,
   defaults, exact ledger and preservation of all other email controls.
5. Independently reread the history, schema/security and controls. Require 41
   exact rows, the new SQL digest, intended nullability/function definitions and
   paid sending paused. No purchase, entitlement, consent or participant changes
   are authorized.
6. With the already approved deployment, run the release preflight and publish
   once through the authenticated publisher. Verify exact live commit/fingerprint.
   Keep paid sending paused if publication or verification fails. Don't stack
   publication requests or restore an older worker against new recovery jobs.
7. Once the compatible release is verified, restore only paid-access sending to
   its recorded prior value (true), using an expected-state check. Confirm all
   other controls remain unchanged. Restore no ownership and open no intake.
8. Verify a controlled fresh recovery request and delivery, clean-browser account
   access, existing purchase/refund visibility and denial of refunded workouts.
   Don't claim the functional acceptance pass until evidence supports it. Any
   email send must stay within Todd's explicit controlled-test authorization.

On timeout or uncertain outcome, reread state before retrying. Exact new ledger
row plus matching schema means committed; unchanged baseline means unapplied.
Mixed state requires investigation and a reviewed forward repair, never deleting
history. Record execution, deployment and remaining test evidence in issue #97.
Contact editing, Account layout and new billing/invoice screens remain separate.
