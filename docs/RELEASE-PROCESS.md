# Gen X Jumps Release Process

GitHub `release/v1.1` is the source of truth for production code. Lovable is the build/publish surface, not a development workspace or an alternate source branch.

## Production release contract

1. Create an isolated branch from the current `release/v1.1` head.
2. After changing any build input, run `bun run release:manifest`, then open a PR into `release/v1.1`.
3. Do not merge unless the full Quality Gate is green.
4. Recheck the base branch, exact PR head SHA, changed-file list, and mergeability immediately before merging.
5. Merge only the exact verified PR head.
6. Wait for the independent post-merge Quality Gate on the resulting release SHA.
7. Confirm Lovable's `latest_commit_sha` exactly equals the green GitHub release SHA. Do not edit or reconcile source in Lovable.
8. Publish once from that exact synced state. Avoid stacking repeated publish requests.
9. Run `bun run release:fingerprint` against the exact GitHub release tree and verify `GET /api/public/release` reports the same source fingerprint.
10. Run the release-specific production smoke tests in `docs/RELEASE-CHECKLIST.md`.

A release is complete only when the approved code, Lovable source, running production identity, schema/configuration state, and smoke-test evidence agree.

## Build-time configuration guard

Production builds must contain:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- A valid `release-source-manifest.json` matching every tracked build input and every corresponding file digest

`bun run build` runs `scripts/assert-production-env.ts` first. A build with missing client configuration, a stale manifest, or any source file that differs from its reviewed digest must fail instead of replacing the working production release.

GitHub builds also record the full commit SHA. Lovable Pro omits Git metadata and does not provide a commit environment variable, so Lovable builds use the verified source fingerprint as their fail-closed identity. The fingerprint is mapped back to the exact approved GitHub release tree during production verification.

The tracked `.env` contains only browser-public Lovable Cloud `VITE_SUPABASE_*` configuration. Never add service-role keys, provider credentials, scheduler secrets, or other server-only values to it. CI may override the browser-public values with placeholders to exercise the build path.

## Deployed-code proof

The build verifies every file listed in `release-source-manifest.json` and injects the resulting SHA-256 source fingerprint into a public, read-only endpoint:

```text
GET https://app.genxjumps.com/api/public/release
```

The response must:

- Return the application name and a `sha256:` source fingerprint.
- Return the full Git commit SHA when the builder provides trustworthy Git metadata; `commit` may be `null` on Lovable.
- Use `cache-control: no-store`.
- Match `bun run release:fingerprint` when run against the exact green `release/v1.1` tree published through Lovable.

A changed JavaScript filename is useful deployment evidence, but it is not sufficient proof of the code revision by itself.

The manifest intentionally excludes itself to avoid a self-referential digest. It covers browser-public environment configuration, dependency locks, build/test configuration, public assets, scripts, application source, and Supabase source/migrations. GitHub builds additionally verify that the manifest's file list exactly matches the tracked build inputs. Run `bun run release:manifest` whenever one of those files is added, removed, renamed, or changed.

## Lovable source-drift rule

- GitHub source changes reach Lovable only through Git sync from approved commits.
- Do not use Lovable chat, visual edits, or code edits to repair production source.
- Before publishing, compare Lovable's complete `latest_commit_sha` with the exact GitHub release SHA.
- If the SHAs differ, stop. Reconcile through GitHub and Git sync - never by copying selected files into Lovable.
- If Lovable creates a direct release-branch commit, treat it as unapproved drift. Do not publish it. Restore the branch through a reviewed PR or an explicit forward revert without rewriting history.

## Forward-only rollback

Rollback preserves Git history and database evidence. Never force-push or reset a published branch.

For an application-code incident:

1. Identify the first bad release SHA and the last known-good SHA.
2. If the incident can cause external side effects, disable only the affected operational gate before continuing.
3. Create `agent/rollback-<reason>` from the current `release/v1.1` head.
4. Revert the bad merge commit on that branch. Do not rewrite published history.
5. Open a PR, run the complete Quality Gate, and verify the exact PR head.
6. Merge the revert and wait for the independent post-merge gate.
7. Confirm Lovable synced to the new revert SHA and publish once.
8. Verify `/api/public/release` reports the revert release's source fingerprint and run the affected smoke tests.
9. Record the bad SHA, revert SHA, deployment ID, impact, and follow-up repair.

Database changes are not rolled back by deleting data or running an unreviewed down migration. Use a verified forward-repair migration. Configuration rollback restores the last known-good values through the appropriate configuration store without exposing private values.

## Recovery/auth production smoke test

For recovery or authentication changes:

1. Request one transactional recovery email for the controlled test plan.
2. Open the recovery link in a clean browser context.
3. Confirm `/return` establishes access and redirects to `/your-plan`.
4. Confirm the plan loads without prior localStorage, cookies, or login state.
5. Reuse the same still-valid link in a second browser/device.
6. Confirm a separate session is established and the first session remains valid.
7. Confirm customer authentication initializes without a missing-Supabase configuration error.

Do not call a release complete just because a deploy request was accepted.
