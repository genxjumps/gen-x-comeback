# 7-Day Website Onboarding Contract

## Purpose

Move a visitor from the website hero opt-in into the app without asking for their name or email a second time. The transition must feel immediate, explain what happened, and make Home Screen installation prominent without blocking the plan.

## Participant flow

1. The website hero submits first name, email, explicit consent, and attribution fields to `POST /intake/7-day`.
2. The app validates the website origin, rate-limits the request, stores a 24-hour intake handoff, queues the welcome email, and sets an HTTP-only handoff cookie. Existing plans follow the approved recovery contract below.
3. The participant lands on `/welcome` and sees three scannable states: Access saved, Quick setup, Plan ready.
4. `Create My 7-Day Plan` starts the assessment. The participant is told it takes about two minutes and requires no password.
5. Assessment completion claims the intake and creates the plan without another identity form.
6. `/plan-ready` immediately offers device-appropriate Home Screen installation. Choosing `Not Now - View My Plan` always opens the plan.
7. A dismissed install prompt can reappear as a compact plan-page nudge after 24 hours.

## Calendar and progression behavior

- The participant's browser time zone is captured when the plan is first saved. The server anchors Day 1 to that local calendar date; Day N is assigned to Day 1 plus N minus one calendar days. Unlocking is never based on an elapsed 24-hour timer.
- The earliest unfinished assignment is labeled `Tomorrow's Workout/Movement` before its assigned date, `Today's Workout/Movement` on its assigned date, and `Your Next Workout/Movement` after a missed date. Recovery and rest use the equivalent assignment noun. Do not label a missed assignment `Yesterday's Workout` and do not introduce stacking or guilt language.
- Participants may read future-day details, guidance, modifications, and equipment notes. A future workout video remains a non-playing poster until both its assigned date has arrived and every earlier day is complete.
- Video assignments use one branded 16:9 background for each plan day, including the optional Day 7 active-recovery video. The day label and saved workout name are live app text, not baked into the artwork, because one calendar day can contain different workouts across schedule templates.
- The media card status rail reflects real plan state: `Complete Day N First` links to the prerequisite, `Available [weekday]` remains non-playing, `Start Workout` opens the real player, and `Completed` offers replay. Locked states never mount a playable iframe.
- Completion is enforced on the server. A day cannot be marked complete before its local assigned date or before an earlier required day.
- A completed assignment screen has one primary route back to the plan. Short movement and rest pages do not repeat a second bottom `Back to My Plan` action.

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

The immediate welcome-and-resume email is implemented in the bounded signup-recovery checkpoint below. It returns an unfinished participant to welcome or their same-browser draft without waiting for Plan Ready. Plan Ready remains a separate email sent only after the plan is successfully committed.

After a successful new-plan save, both the website handoff and direct signup paths
immediately wake the existing authenticated email scheduler. The handoff wake occurs
after the atomic plan/calendar/outbox commit and before browser-session issuance;
the direct path wakes after calendar configuration succeeds. This requests an immediate
delivery attempt, not guaranteed instant inbox arrival. A failed wake never fails the
saved-plan response: the durable outbox and five-minute scheduler remain the retry
path. Exact save retries can wake the same queued job again without creating another
Plan Ready email. Failed saves, expired handoffs, and existing-plan resume outcomes
do not wake the sender. Existing sending, consent, suppression, and provider-cap
controls still apply. This does not change reassessment or completed-plan restart.

During closed-intake testing, successful completion of an allowed handoff moves the existing production email fence to that exact new plan. It does not enable sending or admit genuine plans. This lets a new allowed Gmail plus alias receive its test Plan Ready email without manually replacing a secret or database control value after every run.

Plan Ready resolves saved completion progress when the queued message is actually dispatched. A delayed message must direct the participant to the next unfinished scheduled day instead of telling someone who already completed Day 1 to start Day 1.

## Approved abandonment and repeat-signup contract

Approved September 9, 2026. The implementation is prepared on
`agent/seven-day-signup-recovery`; migration application, merge, publication,
and opening public intake remain separate approvals.

- Signup queues a transactional welcome-and-resume email before assessment completion.
  Its durable outbox is independent of MailerLite. A best-effort wake invokes the
  existing authenticated scheduler; the five-minute tick retries if the wake fails.
- Rapid submissions for the same normalized email share one welcome job per
  five-minute bucket. Per-email and per-caller rate limits apply. Provider retries
  retain exactly the same payload, token, and idempotency key and stop before the
  provider's 24-hour deduplication horizon.
- No saved plan: the secure link returns to `/welcome`. Browser-local answers may
  resume at the first unfinished assessment stage only in the browser holding
  that participant's draft. A different browser/device starts fresh at Step 1
  after the existing eligibility check. Answers are not synchronized to the server.
- Incomplete saved plan: resume that exact plan, preserving its version, calendar,
  progress, sessions, and existing lifecycle jobs.
- Completed saved plan: open the completed plan. Only secure access followed by
  an explicit confirmation in My Plan can start another week. Repeat signup and
  welcome-link exchange never restart anything. Restart uses the same workouts,
  archives the completed run, starts Day 1 on today's local date, and is idempotent.
- A matching authorized session may open its own saved plan immediately. Typing
  an email and receiving a signup cookie does not prove ownership of an existing
  plan. Otherwise the participant uses the emailed secure link.
- Email credentials and the original signup cookie are separate capabilities.
  `/signup/return` GET only renders a button; deliberate same-origin POST establishes
  a new browser session. Reusing a valid link does not revoke another browser's
  access. Welcome links last 30 days and resolve current saved state when opened.
- Draft ownership uses an opaque server-derived participant key. Another identity
  in the same browser cannot inherit the previous participant's assessment.
- Plan save, calendar configuration, intake completion, controlled Plan Ready scope,
  and Plan Ready outbox creation succeed or roll back together. Retry returns the
  original saved result. Distinct submissions for an existing email never replace it.
- The Change My Answers action in the plan navigation also requires a deliberate
  confirmation before applying changed answers. Completed plans use the separate restart action.
- Welcome is requested transactional access, independent of marketing and proactive
  Plan-email consent. Existing consent flags remain distinct; opening a welcome
  link changes neither preference. Explicit signup marketing consent remains in
  the intake's MailerLite sync path. Plan Ready remains a separate post-save email.
- Sending uses existing activation and suppression controls and the shared rolling
  provider reservation limit. During closed intake only server-admitted controlled
  test intakes qualify for welcome delivery. No control is enabled by the migration.
- Missing/expired links and save conflicts offer a path back to welcome or a new
  signup with the same email. They never instruct the participant to use a different
  email or replace saved progress to work around an error.

See [checkpoint verification](SIGNUP-RECOVERY-CHECKPOINT.md) for test evidence,
release dependencies, and the remaining controlled live tests.

## Home Screen behavior

- iPhone and iPad: show Share, Add to Home Screen, Add.
- Android or compatible desktop browser: use the captured native install prompt when available.
- Other browsers: show the browser-menu installation path.
- Standalone display is detected and remembered.
- Successful desktop installation says `Gen X Jumps is installed.` Successful mobile installation says `Gen X Jumps is on your Home Screen.`
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
| Day 1 completed same day   | Day 2 is Tomorrow's Movement and cannot complete  |
| Assigned date arrives      | Assignment changes to Today's type and unlocks    |
| Assigned date was missed   | Earliest unfinished day changes to Your Next type |
| Future workout opened      | Details show; video stays locked behind poster    |
| Delayed Plan Ready email   | Closing line reflects current saved progress      |
