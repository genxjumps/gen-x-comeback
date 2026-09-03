# Gen X Jumps Release Process

GitHub `release/v1.1` is the source of truth for production code. Lovable is the build/publish surface, not the authoritative release branch.

## Production release contract

1. Work happens on an isolated branch.
2. Open a PR into `release/v1.1`.
3. Do not merge unless the full Quality Gate is green.
4. Merge the exact verified PR head.
5. Reconcile only the intended runtime files into Lovable. Never assume Lovable automatically matches GitHub.
6. Read the reconciled Lovable files directly and compare them to the merged GitHub release before publishing.
7. Publish once after reconciliation. Avoid stacking repeated publish requests unless the previous deployment is known bad or stale.
8. Verify the production surface before asking a real user to test.
9. Run the smallest meaningful production smoke test for the changed path.

## Build-time configuration guard

Production builds must contain:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

`bun run build` runs `scripts/assert-production-env.ts` first. A build with either value missing must fail rather than publish a client bundle that cannot initialize Supabase.

CI uses non-secret placeholder values only to exercise the build path. Production values remain in the deployment environment.

## Lovable reconciliation rule

Never accept an agent statement such as "already matches" as proof by itself.

For release-critical files:

1. Read the merged GitHub file.
2. Read the Lovable project file directly.
3. Compare the actual contents.
4. If they differ, reconcile only the intended files.
5. Read them again after the Lovable edit.
6. Only then publish.

High-risk runtime files currently include:

- `src/start.ts`
- `src/lib/safe-supabase-auth-attacher.ts`
- `src/routes/return.ts`
- `src/lib/plan-access.server.ts`
- `src/integrations/supabase/client.ts`

The exact list should follow the files changed by the release. Do not touch generated Supabase files or unrelated code merely to make Lovable appear synchronized.

## Production smoke tests

Choose tests based on the change. For recovery/auth changes, the minimum production test is:

1. Request a recovery email.
2. Open the recovery link in a clean browser context.
3. Confirm `/return` establishes access and redirects to `/your-plan`.
4. Confirm the plan loads without relying on prior localStorage or browser state.
5. Confirm a second browser/device can repeat the flow from the same valid recovery email when that behavior is intended.

Do not call a release complete just because deploy was accepted. A successful publish plus a successful production smoke test is the release boundary.
