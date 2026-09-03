# Production Migration-History Reconciliation - 2026-09-03

## Authorization and release boundary

- Explicit approval: Todd approved the live migration-history metadata repair.
- GitHub release SHA: `3ca0a40c73270d328ec9b6ec6c307247dcf90dee`
- Post-merge Quality Gate: run `33818713755`, successful on the exact release SHA.
- Supabase project reference: `wrvjgjvdjjoytjdwntlx`
- Completion timestamp: `2026-09-03T23:54:28Z`
- Scope: `supabase_migrations.schema_migrations` metadata only.
- Application schema/data changes: none.
- Application publish: none.

## Verified starting state

- Canonical Git migration count: 27.
- Remote history row count: 25.
- Alias `20260902143723` stored SQL digest: `f90fee89d873658b498bb84bf4edefac61135bddf6a3f98dc584c7db15c9c660`.
- Alias `20260902144059` stored SQL digest: `38506c0a1598da9a50d1943e9e42188ba508a8a213240495437ec6c4f7910148`.
- Those digests exactly matched canonical customer-account and Accelerator migrations.
- Marketing-sync and recovery migrations were absent from history, while their required production objects and logic were present.
- Legacy canonical version `20260807193000` had the correct name but no stored SQL statement. Its production objects and operational controls were verified semantically.

## Approved history operations

The operations matched Supabase CLI `migration repair` semantics. Each operation ran separately, followed by an independent remote history read.

1. Removed alias version `20260902143723` after its name and SQL digest matched the expected alias.
2. Removed alias version `20260902144059` after its name and SQL digest matched the expected alias.
3. Recorded canonical `20260828150000_mailerlite_marketing_sync` with statement digest `898976d1448e1c84950171a1a56c4d75b39e54fa5c00f64f5c17a29b32c71527`.
4. Recorded canonical `20260828170000_customer_account_foundation` with statement digest `f90fee89d873658b498bb84bf4edefac61135bddf6a3f98dc584c7db15c9c660`.
5. Recorded canonical `20260828180000_accelerator_enrollment_progress` with statement digest `38506c0a1598da9a50d1943e9e42188ba508a8a213240495437ec6c4f7910148`.
6. Recorded canonical `20260902183000_recovery_transactional_claim_contract` with statement digest `2f0178ba1157754393757a5f2c0b125b09968984244f3866b9545f39238669f2`.

The execution environment had neither a Supabase CLI binary nor a Supabase database credential. The authorized production database connection was used with the CLI's exact documented `DELETE` and `UPSERT(version, name, statements)` behavior, plus stricter digest preconditions on alias removal.

## Final verification

- Remote history count: 27.
- Locked Git history count: 27.
- Missing versions: none.
- Extra versions: none.
- Version/name mismatches: none.
- Stored SQL digest mismatches: none, excluding the separately verified legacy empty-statement row `20260807193000`.
- Expected protected tables: 15 of 15 present, all with RLS and service-role policies.
- Expected functions: 36 of 36 present, all matching intended security mode, fixed search path, and execute permissions.
- Expected indexes: 16 of 16 present.
- Expected triggers: 2 of 2 present.
- Recovery transactional bypass: present in both claim and provider-attempt functions.
- Marketing consent consulted by recovery pipeline: no.
- Hard-bounce/complaint suppression and provider limit: present.
- Production sending enabled: yes.
- Genuine plans admitted: no.
- Controlled test plan configured: yes.
- Provider submission limit: 10.

An exact remote-versus-lock comparison proved there are no pending, missing, or extra migration versions. A literal Supabase CLI dry-run was unavailable in this execution environment. Future production schema changes still require the normal linked CLI dry-run from an approved environment.
