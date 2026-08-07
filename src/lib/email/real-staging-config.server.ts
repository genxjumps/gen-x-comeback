// Real-provider staging dispatch configuration. Server-only.
//
// Deliberately separate from both the production email configuration and the
// fake-staging configuration: nothing here can widen `evaluateSendingGate()`,
// and nothing here reuses or overwrites `EMAIL_DISPATCH_SECRET` or
// `EMAIL_STAGING_DISPATCH_SECRET`.

export const EMAIL_REAL_STAGING_ENABLED_ENV = "EMAIL_REAL_STAGING_ENABLED";
export const EMAIL_REAL_STAGING_DISPATCH_SECRET_ENV = "EMAIL_REAL_STAGING_DISPATCH_SECRET";
export const EMAIL_REAL_STAGING_ALLOWED_RECIPIENT_ENV = "EMAIL_REAL_STAGING_ALLOWED_RECIPIENT";

export type RealStagingConfig = {
  /** Server-side switch. Defaults to false: request input can never enable it. */
  enabled: boolean;
  /** Dedicated real-staging bearer secret. No default. */
  dispatchSecret: string | null;
  /** The single recipient a real staging send may ever reach. No default. */
  allowedRecipient: string | null;
};

function env(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readRealStagingConfig(): RealStagingConfig {
  const allowed = env(EMAIL_REAL_STAGING_ALLOWED_RECIPIENT_ENV);
  return {
    enabled: env(EMAIL_REAL_STAGING_ENABLED_ENV) === "true",
    dispatchSecret: env(EMAIL_REAL_STAGING_DISPATCH_SECRET_ENV),
    allowedRecipient: allowed ? allowed.toLowerCase() : null,
  };
}

/** Case-insensitive exact match. No pattern, domain, or prefix matching. */
export function recipientIsAllowed(candidate: string | null, allowed: string | null): boolean {
  if (!candidate || !allowed) return false;
  return candidate.trim().toLowerCase() === allowed.trim().toLowerCase();
}
