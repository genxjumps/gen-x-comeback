# Production Release Checklist

Record the evidence for every production publish. Use `not applicable` with a reason rather than silently skipping a control.

## Approved code

- [ ] Isolated branch and PR target `release/v1.1`.
- [ ] `bun run release:manifest` was run after the final build-input change.
- [ ] Complete PR Quality Gate is green.
- [ ] Base branch, exact PR head SHA, changed files, and mergeability were rechecked before merge.
- [ ] Independent post-merge Quality Gate is green on the release SHA.

## Source and deployment identity

- [ ] Lovable `latest_commit_sha` exactly matches the green GitHub release SHA.
- [ ] Publish was triggered once from that exact synced state.
- [ ] Deployment ID and production JavaScript bundle filename were recorded.
- [ ] `bun run release:fingerprint` was run against the exact GitHub release tree.
- [ ] `/api/public/release` reports that exact source fingerprint with `cache-control: no-store`.
- [ ] The endpoint's `commit` matches the release SHA when available, or is recorded as `null` for a builder without trustworthy Git metadata.

## Database and generated files

- [ ] Every required migration exists in Git and has an understood production application state.
- [ ] No unexplained production migration exists outside the repository ledger.
- [ ] Schema changes are forward-only and were reviewed before application.
- [ ] Generated Supabase types match the reviewed schema and contain no unrelated formatting churn.
- [ ] No destructive data cleanup or schema reversal was bundled into the release.

## Configuration and external effects

- [ ] Required browser-public build configuration is present.
- [ ] Server-only secrets are present in the correct backend store and absent from Git/logs.
- [ ] Production origin, redirects, cookie attributes, and authentication configuration were checked when affected.
- [ ] Email sending, genuine-plan admission, controlled-plan scope, suppression, and provider limits remain at their approved values.
- [ ] Payment and other externally consequential integrations remain disabled or narrowly controlled unless explicitly approved.

## Smoke tests and completion

- [ ] Public application shell loads on the custom domain.
- [ ] Changed customer path passes its smallest meaningful end-to-end smoke test.
- [ ] Recovery/auth changes pass the clean-browser and cross-device contract.
- [ ] Database writes, email submissions, and other side effects were limited to approved test records.
- [ ] Release SHA, source fingerprint, deployment ID, schema state, configuration state, smoke-test result, and any follow-up were recorded.
- [ ] Last known-good release and forward-rollback procedure are identified.
