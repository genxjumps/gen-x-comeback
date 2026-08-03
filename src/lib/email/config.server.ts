// Server-only deployment configuration for outbound email. Fail-closed:
// production sending stays disabled until every contract prerequisite is set.

export type EmailConfig = {
  appOrigin: string | null;
  providerKey: string;
  providerApiKey: string | null;
  fromEmail: string | null;
  fromName: string;
  replyTo: string | null;
  webhookSecret: string | null;
  sendingEnabled: boolean;
  clickTrackingDisabled: boolean;
  alertsEnabled: boolean;
  domainVerified: boolean;
  stagingAcceptancePassed: boolean;
};

function env(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function flag(name: string): boolean {
  return env(name) === "true";
}

export function readEmailConfig(): EmailConfig {
  return {
    appOrigin: env("APP_ORIGIN"),
    providerKey: env("EMAIL_PROVIDER") ?? "resend",
    providerApiKey: env("EMAIL_PROVIDER_API_KEY") ?? env("RESEND_API_KEY"),
    fromEmail: env("EMAIL_FROM_ADDRESS"),
    fromName: env("EMAIL_FROM_NAME") ?? "Todd from Gen X Jumps",
    replyTo: env("EMAIL_REPLY_TO"),
    webhookSecret: env("EMAIL_WEBHOOK_SECRET"),
    sendingEnabled: flag("EMAIL_SENDING_ENABLED"),
    clickTrackingDisabled: flag("EMAIL_CLICK_TRACKING_DISABLED"),
    alertsEnabled: flag("EMAIL_ALERTS_ENABLED"),
    domainVerified: flag("EMAIL_SENDING_DOMAIN_VERIFIED"),
    stagingAcceptancePassed: flag("EMAIL_STAGING_ACCEPTANCE_PASSED"),
  };
}

export type SendingGate =
  | { enabled: true; config: EmailConfig }
  | { enabled: false; missing: string[] };

/**
 * Every prerequisite in the contract's release gate must be present before a
 * real provider attempt is allowed.
 */
export function evaluateSendingGate(config: EmailConfig = readEmailConfig()): SendingGate {
  const missing: string[] = [];
  if (!config.sendingEnabled) missing.push("EMAIL_SENDING_ENABLED");
  if (!config.appOrigin || !/^https:\/\//.test(config.appOrigin)) missing.push("APP_ORIGIN");
  if (!config.providerApiKey) missing.push("EMAIL_PROVIDER_API_KEY");
  if (!config.fromEmail) missing.push("EMAIL_FROM_ADDRESS");
  if (!config.replyTo) missing.push("EMAIL_REPLY_TO");
  if (!config.webhookSecret) missing.push("EMAIL_WEBHOOK_SECRET");
  if (!config.domainVerified) missing.push("EMAIL_SENDING_DOMAIN_VERIFIED");
  if (!config.clickTrackingDisabled) missing.push("EMAIL_CLICK_TRACKING_DISABLED");
  if (!config.alertsEnabled) missing.push("EMAIL_ALERTS_ENABLED");
  if (!config.stagingAcceptancePassed) missing.push("EMAIL_STAGING_ACCEPTANCE_PASSED");
  if (missing.length > 0) return { enabled: false, missing };
  return { enabled: true, config };
}

/** App origin used to build links. Falls back to the known production origin. */
export function resolveAppOrigin(config: EmailConfig = readEmailConfig()): string {
  return (config.appOrigin ?? "https://app.genxjumps.com").replace(/\/+$/, "");
}
