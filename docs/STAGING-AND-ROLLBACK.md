# Staging and Rollback Boundary

## Current pre-launch posture

Gen X Jumps is still in controlled pre-launch validation. The public production domain is used to exercise real hosting behavior, but there are no live paid customers and external effects remain bounded:

- Genuine email plans are not admitted.
- The email scheduler is restricted to the controlled test plan.
- The provider submission limit is 10.
- Real payment processing and public Accelerator enrollment are not authorized.
- Test records must be deliberate and identifiable.

This posture allows V1.1 development to continue without creating another Lovable project or prematurely adding a second backend. It is not the permanent production architecture.

## Hard staging trigger

A separate staging environment is required before any of these production gates may open:

- `genuine_plans_admitted` changes to `true`.
- Real payment processing is enabled.
- The 28-Day Fat Loss Accelerator opens for public enrollment.
- Production Accelerator email is enabled beyond controlled tests.
- Real customer data is deliberately admitted into the platform.

The staging architecture is a consequential platform/configuration decision. It requires Todd's explicit approval. This document does not authorize creating another Lovable project, cloning production data, changing DNS, or provisioning a new Supabase project.

## Required staging parity

The approved staging environment must exercise the production behavior that local tests cannot prove:

- The same framework adapter and hosting runtime.
- HTTPS on a stable staging hostname.
- Production-equivalent cookie attributes, redirects, route protection, and auth callbacks.
- A separate database/auth backend with the same migration history replayed from `supabase/migration-lock.json`.
- Staging-only secrets and browser-public configuration.
- Transactional email routed only to approved test recipients or a non-delivery sink.
- Marketing sync disabled or connected only to a staging/test destination.
- Payment-provider test mode with no ability to create a real charge.
- Scheduler and rate-limit behavior that can be exercised without touching production records.
- Disposable, non-customer test data.

Sharing the production database, auth users, provider credentials, or customer records does not qualify as staging.

## Promotion proof

Production may receive only the exact release candidate proven in staging:

1. Merge the reviewed PR into `release/v1.1` and wait for the exact-SHA post-merge Quality Gate.
2. Apply only the expected locked migrations to staging.
3. Run the affected staging smoke tests, including clean-browser and cross-device recovery when cookies/auth change.
4. Record the staged SHA, source fingerprint, migration versions, configuration class, and test results.
5. Run the production migration dry-run from the same clean release checkout.
6. Obtain explicit approval for any production schema, configuration, payment, email, or publish action.
7. Use the controlled one-path publish process and verify the live source fingerprint.

A similar build is not sufficient. The staged SHA and migration-lock state must equal the production candidate exactly.

## Rollback readiness

Every genuine-customer production release must record:

- The new release SHA and deployment ID.
- The last known-good release SHA and deployment ID.
- The remote migration versions and migration-lock digest state.
- The approved production configuration class without exposing secret values.
- The operational gate that can stop affected external side effects.
- The smallest smoke test that proves recovery.

Application rollback is a forward Git revert through an isolated branch, PR, full Quality Gate, exact-SHA merge, controlled publish, and production fingerprint verification. Published branch history is never rewritten.

Database rollback uses a reviewed forward-repair migration. Do not run an unreviewed down migration, delete customer data, or remove schema objects to imitate an application rollback.

Configuration rollback restores the last known-good values through the owning configuration store. If an incident can send email, charge money, or create another external side effect, disable only the affected operational gate while the forward repair is prepared.

## Required rollback drill

Before the first genuine-customer launch, perform one non-production drill:

1. Select a harmless staging release as the simulated bad release.
2. Disable its test-only external-effect gate.
3. Create and merge a forward revert through the protected release workflow.
4. Publish once and verify the exact revert fingerprint.
5. Run the affected staging smoke test.
6. Restore forward through another reviewed change if needed.
7. Record timings, failed assumptions, and process corrections.

The launch gate passes only when the team can identify what is running, stop the relevant external effect, restore a known-good application release, and verify the result without rewriting history or improvising database changes.
