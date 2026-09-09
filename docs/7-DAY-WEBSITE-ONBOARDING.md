# 7-Day Website Onboarding Contract

## Purpose

Move a visitor from the website hero opt-in into the app without asking for their name or email a second time. The transition must feel immediate, explain what happened, and make Home Screen installation prominent without blocking the plan.

## Participant flow

1. The website hero submits first name, email, explicit consent, and attribution fields to `POST /intake/7-day`.
2. The app validates the website origin, rate-limits the request, stores a 24-hour one-time intake, and sets an HTTP-only handoff cookie.
3. The participant lands on `/welcome` and sees three scannable states: Access saved, Quick setup, Plan ready.
4. `Build My 7-Day Plan` starts the assessment. The participant is told it takes about two minutes and requires no password.
5. Assessment completion claims the intake and creates the plan without another identity form.
6. `/plan-ready` immediately offers device-appropriate Home Screen installation. Choosing `Not Now - View My Plan` always opens the plan.
7. A dismissed install prompt can reappear as a compact plan-page nudge after 24 hours.

## Security and privacy

- The public intake route fails closed with `NEW_PLAN_INTAKE_OPEN`.
- While public intake is closed, a server-only `NEW_PLAN_INTAKE_TEST_EMAILS` allowlist can admit exact normalized test identities through the complete handoff. From the separately configured external preview origin only, a configured Gmail base identity also admits its valid plus aliases so repeated fresh-user tests do not require Secret changes or deployment churn. A configured plus alias never creates a broader alias family. Keep addresses in the backend secret store, never in source control.
- Only the production website, configured website origin, same-origin app requests, and local development origins are accepted.
- The raw handoff token is kept in an HTTP-only, SameSite=Lax cookie and only its SHA-256 hash is stored.
- Intake rows expire after 24 hours and can be claimed once for a specific assessment submission.
- Public clients have no direct table or RPC access. Server operations use the service role.
- Error pages contain no submitted personal information and are marked `noindex`.

## Email behavior

The approved consent text is stored with the opt-in. A durable MailerLite sync job is queued at website opt-in, independently of assessment completion. Existing plan-based sync remains in place and provider upserts are idempotent.

An immediate welcome-and-resume email after website opt-in is an approved follow-up requirement. It must return an unfinished participant to the welcome screen or first unanswered assessment step without waiting for Plan Ready. Plan Ready remains a separate email sent only after the plan is successfully committed.

## Open product decision

When an email with an existing 7-Day Plan opts in again, the app must never fail silently or create a duplicate identity. Before public launch, decide whether the participant should resume the existing plan, rebuild and replace it, or explicitly choose between those actions. The September 9 controlled test exposed a database ambiguity in the current replacement path; that defect and the participant-facing behavior require a separate repair checkpoint.

## Home Screen behavior

- iPhone and iPad: show Share, Add to Home Screen, Add.
- Android or compatible desktop browser: use the captured native install prompt when available.
- Other browsers: show the browser-menu installation path.
- Standalone display is detected and remembered.
- Installation events are recorded without storing additional personal information.

## Release controls

- Keep `NEW_PLAN_INTAKE_OPEN` false until the migration, app deployment, website handoff, and end-to-end test are all ready.
- During controlled testing, configure `NEW_PLAN_INTAKE_TEST_EMAILS` with the approved base test identity. Exact configured identities remain allowed through trusted intake origins. Valid Gmail plus aliases of a configured base identity are allowed only from the separately configured external preview origin. All other new-plan identities remain blocked.
- Apply `20260907210000_website_lead_intake_handoff.sql` only through the repository migration workflow after a fresh read-only production comparison and explicit approval.
- Test on iPhone Safari from hero submission through Home Screen launch before opening intake publicly.

## Minimum verification matrix

| Scenario                   | Expected result                                   |
| -------------------------- | ------------------------------------------------- |
| Valid website opt-in       | Redirects to personalized `/welcome`              |
| Invalid or missing consent | Generic validation error, no intake created       |
| Untrusted origin           | Request rejected                                  |
| Expired or missing handoff | Return-to-signup recovery screen                  |
| Exact assessment retry     | Same submission identity, no duplicate plan       |
| Handoff completion         | No second name/email form, then `/plan-ready`     |
| Fresh alias from preview   | Configured Gmail base alias reaches welcome       |
| Alias from other origin    | Request rejected without an intake row            |
| Start Day 1                | Records activation exactly once, then opens Day 1 |
| iPhone install             | Share, Add to Home Screen, Add instructions       |
| Install dismissed          | Plan opens; nudge waits 24 hours                  |
| Standalone launch          | Plan opens without another install prompt         |
