// Staging-only fake-provider dispatch configuration. Server-only.
//
// This is deliberately separate from the production email configuration and the
// production release gate: nothing here can widen `evaluateSendingGate()`, and
// nothing here reuses or overwrites `EMAIL_DISPATCH_SECRET`.

export const EMAIL_FAKE_STAGING_ENABLED_ENV = "EMAIL_FAKE_STAGING_ENABLED";
export const EMAIL_STAGING_DISPATCH_SECRET_ENV = "EMAIL_STAGING_DISPATCH_SECRET";

export type FakeStagingConfig = {
  /** Server-side switch. Defaults to false: request input can never enable it. */
  enabled: boolean;
  /** Dedicated staging bearer secret. No default. */
  dispatchSecret: string | null;
};

function env(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readFakeStagingConfig(): FakeStagingConfig {
  return {
    enabled: env(EMAIL_FAKE_STAGING_ENABLED_ENV) === "true",
    dispatchSecret: env(EMAIL_STAGING_DISPATCH_SECRET_ENV),
  };
}
