# Controlled refund Cloud migration procedure

Status: proposed for Todd's explicit adoption with PR merge. Implementation
approval permits preparing and testing this procedure; it doesn't authorize
merging, applying SQL, configuring roles/providers, or publishing. Once adopted,
application still requires its own explicit approval after fresh preflight.

## Exact scope

Only the following pair may use this exception, in order and in one transaction,
on Lovable project `9882f922-c17b-4fca-bd5b-48b9548e5322`, Supabase reference
`wrvjgjvdjjoytjdwntlx`. Don't commit the foundation without the permissions fix.

| Migration                                           | Byte SHA-256                                                       | Statement SHA-256                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `20260910100000_accelerator_refund_requests.sql`    | `604ce6c148d5e605f9b74621c2c540b3cdda4deb82c68f8cbdbfcd474dabfa8d` | `e29d18ab6905da42104ebe672d16bbb20fa01df5623cd689b84c0b0b29f4b713` |
| `20260910110000_accelerator_refund_permissions.sql` | `f44c4a4e09c6ae1919fc9260d677626b3d46d84bbe84dc2224963d0120750e23` | `6531ea0f88ec75e44ed049348169013bba100ccf006a994d4a9904e95be6b6ed` |

The original PR #93 migration remains immutable. The fix changes grants only on
the three new refund tables and four new refund functions. It preserves owner
administration, RLS, function bodies, history, other objects, role membership,
and global default privileges. It doesn't provision a reviewer or issue refunds.

## Explicit procedural exceptions

For this pair only, adoption replaces the following normal requirements:

1. The authenticated Supabase CLI dry run with an exact read-only remote ledger
   and schema comparison. This establishes the pending set; it isn't a CLI run.
2. The ban on Lovable SQL transport with authenticated `query_database` carrying
   the exact reviewed Git SQL in the transactional envelope below. Lovable chat,
   dashboard schema edits, generated replacement SQL, and history repair remain excluded.
3. Pre-application staging promotion with isolated complete PostgreSQL replay,
   refund acceptance, permission checks under both clean and observed hosted
   defaults, deterministic RPC types, and the full Quality Gate. Controlled
   hosted verification is still required after separately approved deployment.
4. Full Supabase lint/type generation with that isolated security validation and
   deterministic refund RPC argument types. No new browser database access is added.

These accept narrower pre-launch proof. The harness doesn't prove real Supabase
Auth, hosted cookies, scheduler behavior, concurrent database clients, actual
Stripe signatures, or settlement. A separate staging environment remains required
before genuine customers, real payments, or public intake. This exception doesn't
authorize future migrations or extend the earlier signup-only exception.

## Read-only baseline from September 10, 2026

GitHub and Lovable source matched `920992ca8fea6ce8ec0d262dfa75b1ea4ffaf048`.
Its post-merge Quality Gate passed in run `34464563511`. The database was enabled.
The following is evidence from that inspection, not a substitute for fresh reads:

- The remote ledger contained exactly 38 canonical versions through
  `20260909190000`, with matching names and no extra versions. The refund foundation
  was the only pending file at that release; this follow-up adds the second file.
- 36 SQL digests matched a locked byte or statement digest.
- `20260807193000` retained its documented empty statement array.
- `20260904110000` retained stored digest
  `23203519865ebb0a66461a01d2d1b75a4eab29e28c7b342903539823bed89ebe`.
  Removing exactly its one leading newline yielded the locked byte digest
  `260a92ddcfeea57486ef9a4496d7dc851b9ca3949ce9c75d3c07f44960fb4be6`.
  Accept only these specific legacy cases; don't rewrite either row.
- The three refund tables were absent. All 81 public application function bodies
  matched the pre-refund replay. Seven dependency tables, 90 columns, 53 non-null-
  independent constraints, 27 indexes, seven policies, and one trigger matched.
  Sixty-seven NOT NULL constraints appeared as separate catalog objects only in
  the newer local PostgreSQL; each matched the hosted column's nullability.
- Four existing trigger functions had service-role EXECUTE from hosted default
  privileges, absent from the clean fixture. Their bodies and other security
  properties matched. The refund fix doesn't change these functions.
- Hosted PostgreSQL was 17.6. Default table grants included full service-role
  privileges and sandbox-role SELECT/INSERT. Both roles bypass RLS. An isolated
  reproduction proved the original refund migration retained those grants.
  Browser roles remained denied. This was an internal privilege gap, not evidence
  that a customer accessed another customer's records.
- Email controls were `sending_enabled=true`, `genuine_plans_admitted=false`,
  `provider_submission_limit=10`, `paid_access_sending_enabled=true`, with a
  controlled plan configured. Four Stripe purchases had test-mode references;
  one purchase used `internal_test`. No live Stripe references were found.

## Fresh preflight and reviewable application envelope

1. Read current GitHub instructions and use a clean checkout of the exact merged
   release with a successful independent post-merge Quality Gate. Verify both
   migration hashes and run `bun run migration:check`. Confirm Lovable source matches.
2. Reconfirm the project, enabled database, mapped Supabase reference, and
   controlled pre-launch posture. Record gates without secrets or participant data.
   Inspect payment and marketing configuration classes without enabling anything.
3. Export all ledger versions, names, statement counts, and hashes. Require the
   exact 38-row baseline and only the two pending versions above. Stop on drift.
4. Compare the existing provisioning function and its dependencies, constraints,
   triggers, indexes, RLS, grants, and hosted defaults with the canonical pre-refund
   replay. Require absence of all new refund tables/functions. Check compatibility
   with the still-running app. Explain catalog-version differences explicitly.
5. Generate an application envelope from the exact Git bytes and captured
   non-secret before-state. It must contain both migrations unchanged, separate
   canonical history entries, and pre/postcondition assertions. Verify the SQL
   against a disposable database with the observed hosted defaults and seeded
   before-ledger. Prove forced assertion failure rolls everything back, and
   successful execution produces the exact 40-row ledger and intended schema.
6. Review for transaction-incompatible statements and external effects. Neither
   migration executes refund/provisioning functions, creates customers, grants
   reviewer membership, calls a provider, or deletes history during application.
7. Present the exact release, envelope digest, two pending versions, test results,
   and operational before-state for separate application approval. Don't apply
   merely because this procedure or its PR has been approved.

## Approved application and independent verification

After application approval, prove the transport's atomic behavior with a
disposable temporary-table rollback probe that leaves no persistent state.
Stop if atomicity can't be established. Execute the envelope once with:

- One transaction, a transaction-scoped advisory migration lock, a lock on
  `supabase_migrations.schema_migrations`, and bounded lock/statement timeouts.
- Assertions of the exact ledger, schema before-state, and operational gates.
- The foundation followed immediately by the permissions migration.
- Exact object/security assertions, including
  `supabase/accelerator-refunds.permissions.sql`, all expected function bodies,
  and unchanged operational gates. Assert the reviewer allow-list is empty.
- Two plain history INSERTs with canonical version, name, and byte-exact SQL.
  Assert both digests and a 40-row ledger before commit. No upsert/history repair.

Independently reread all 40 history rows and verify schema, grants, function
definitions, generated RPC types, and unchanged controls. The service role must
have only SELECT/INSERT/UPDATE on the new tables and EXECUTE on the four refund
functions, with no grant option. Anonymous, authenticated, and sandbox roles
must have no effective access to those objects. Database owners remain trusted
administrators; these checks don't claim to restrict owners or superusers.

On error or timeout, inspect the ledger and schema before any retry. Both exact
rows plus matching objects mean committed; neither row plus unchanged schema
means unapplied. A partial or unexpected result requires investigation and a
reviewed forward repair, never deletion or history rewriting.

Record non-secret execution evidence through a documentation PR. Reviewer
provisioning, webhook subscriptions, Edge/application deployment, controlled
Stripe refund testing, and public launch retain separate approvals. Application
alone doesn't make refund handling live or complete its end-to-end acceptance.
