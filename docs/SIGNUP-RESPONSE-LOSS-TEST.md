# Signup response-loss test

## Approved scope

Todd approved an isolated fault-injection harness for the signup save recovery
checkpoint. Base: `release/v1.1` at `4ee0ec029da48176890720686d149805faa1a454`.
No application behavior, migration, provider dispatch, credentials, or admission
controls change. Merge remains a separate approval.

## What runs

`src/lib/__tests__/signup-response-loss.test.ts` runs in the regular `bun run test`
and `bun run verify` gates. It uses the real `saveLeadPlanFromHandoff` handler,
input validator, plan generator, request fingerprint, signup RPC functions,
intake-cookie hashing, session-issuance function, and browser submission helper.
It replays the repository's SQL migrations into an in-memory PGlite database.

A loopback-only HTTP server wraps the handler. The database adapter implements only
its required SDK transport calls; persistence, replay decisions, calendar setup,
intake completion, and email outbox behavior execute the actual SQL functions.
Framework request context and cookie emission are adapted to the loopback server.
The scheduler wake is inert and provider submissions must remain zero.

Two deterministic faults are tested:

1. After the handler completes its save and session issuance, query the committed
   state and destroy the HTTP response before sending any headers or body. The
   client must observe transport failure, receiving neither success nor Set-Cookie.
2. Fail session insertion after the save transaction commits. The client receives
   failure without a session cookie, while the plan and outbox remain committed.

After each fault, recreate the client storage wrapper with the same persisted
contents, then use the production submission helper to retry. Assert that:

- The same submission ID and access credential are retained.
- Retry returns `saved` with `replayed: true` and a usable new session cookie.
- That cookie's hash resolves to the same unexpired saved-plan session/version.
- There is still exactly one participant identity, one plan submission, and one
  Plan Ready job.
- Plan version, workout snapshot, answers, and calendar are unchanged.
- A controlled Day 1 completion inserted after the first commit survives retry.
- Every successful production cookie issuance requests Secure, HttpOnly, SameSite=Lax,
  and path `/`.

All test email addresses are inert `example.test` fixtures. The harness accepts no
remote database URL, binds HTTP only to `127.0.0.1` on an ephemeral port, and closes
the server and database afterward. It never calls the live app or an email provider.

## Evidence and limits

Both injected-failure scenarios passed locally on September 9, 2026. The complete
quality gate and exact-head GitHub CI are required before merging.

This is deterministic handler/database/HTTP transport evidence, not a live
production outage test or an automated browser end-to-end test. The React error
screen, retry-button click, full TanStack serialization/hosting adapter, and actual
HTTPS browser cookie acceptance are not exercised here. Storage is an in-memory
implementation of the localStorage interface. PGlite uses inert auth/extension
scaffolding and does not prove simultaneous multi-client database execution.

The separate controlled live two-tab test and participant-confirmed Home Screen
access are recorded on PR #88; they should not be represented as response-loss
injection or an independently observed Safari installation trace. This harness does
not change those evidence boundaries or authorize opening public intake.
