# Controlled Preview Configuration and Forward Sync

Date: 2026-09-09

## Approved release before configuration

- GitHub release branch: `release/v1.1`
- Verified release SHA: `2716ce8cbd5898f1ad812127560d1b26d5a83f41`
- Source fingerprint: `sha256:a28d5a1157f151d19b8036ca341a214d64a1ed2354bb6455e48bee5f6a4b6913`
- Post-merge Quality Gate: run `34353360338`, successful on the exact release SHA.
- Lovable deployment: `905f85fe-8d9a-4f7a-862a-7fa007e1d035`
- Production verification returned `production-verified` with commit-and-source-fingerprint proof.

## Approved configuration scope

Todd approved a controlled preview test while public intake remains closed. The configuration-only
operation added the project-level backend Secret names `WEBSITE_ORIGIN` and
`NEW_PLAN_INTAKE_TEST_EMAILS`. The controlled identity value remains in the backend Secret store and
is intentionally excluded from Git, documentation, logs, and release evidence.

The configured website origin is the exact validated Vercel preview origin:
`https://genxjumps-website-6skchawak-gen-x-jumps.vercel.app`.

The operation did not authorize source edits, migrations, email-control changes, payment-control
changes, public intake, domain changes, or publication.

## Lovable source drift

Lovable reported the secrets configured, but the configuration request also produced direct commit
`3638515c93c730262d4169355f5b94f0a978ccc4` despite explicit instructions not to edit source or
create a commit. The commit changed `.env`, reformatted
`src/integrations/supabase/previewAuthStorage.ts`, and refreshed generated Supabase types.

That commit was not merged into `release/v1.1` and was not published. GitHub `release/v1.1` remained
at the verified SHA above, and the running production identity remained unchanged. A post-operation
request from the Vercel preview origin still returned HTTP 403, so the controlled preview was not
treated as ready for participant testing.

## Forward-sync recovery

This evidence-only checkpoint advances GitHub through the normal reviewed PR path without accepting
the Lovable-generated file changes. Its purpose is to make GitHub authoritative again and give
Lovable a newer approved commit to sync.

Before another publication:

1. Run the complete Quality Gate on this exact PR head.
2. Merge only the verified head into `release/v1.1`.
3. Wait for the independent post-merge Quality Gate.
4. Confirm Lovable's complete `latest_commit_sha` equals the new GitHub release SHA.
5. Run `release:preflight`, publish once, and run `release:verify-production`.
6. Confirm a non-allowlisted identity is rejected without a database row.
7. Confirm the approved controlled identity reaches `/welcome` from the exact preview form.

Until those checks pass, `NEW_PLAN_INTAKE_OPEN` remains `false`, genuine customer intake remains
blocked, and the controlled preview is not approved for testing.
