// Locked Plan Ready (plan_ready_v1) message template. Pure and deterministic:
// no environment reads, no provider calls, no database access.

export const PLAN_READY_PREVIEW_TEXT =
  "Open your personalized plan and start Day 1 when you're ready.";
export const PLAN_READY_FALLBACK_SUBJECT = "Your 7-Day Comeback Plan is Ready";
export const PLAN_READY_SENDER_DISPLAY_NAME = "Todd from Gen X Jumps";
export const PLAN_READY_FOOTER =
  "You received this because you requested a personalized 7-Day Comeback Plan from Gen X Jumps.";
export const PLAN_READY_CTA_LABEL = "Open My Plan";

/**
 * Sanitizes and length-limits a personalized first name. Anything unusable
 * (empty, control characters only, markup) falls back to no personalization.
 */
export function sanitizeFirstName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw
    // eslint-disable-next-line no-control-regex -- control characters are never valid in a name
    .replace(/[<>&"'`\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
  return stripped.length > 0 ? stripped : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type PlanReadyRenderInput = {
  firstName: string | null | undefined;
  /** Absolute secure return URL on the app origin. */
  returnUrl: string;
  /** Absolute purpose-limited email-preferences URL on the app origin. */
  preferencesUrl: string;
};

export type PlanReadyRendered = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  /** Sanitized greeting name, or null when the fallback greeting is used. */
  personalizedName: string | null;
};

export function renderPlanReady(input: PlanReadyRenderInput): PlanReadyRendered {
  const name = sanitizeFirstName(input.firstName);
  const greetingName = name ?? "there";
  const subject = name ? `${name}, your 7-Day Comeback Plan is Ready` : PLAN_READY_FALLBACK_SUBJECT;

  const returnUrl = input.returnUrl;
  const preferencesUrl = input.preferencesUrl;

  const text = [
    `Hey ${greetingName},`,
    "",
    "Your personalized 7-Day Comeback Plan is ready.",
    "",
    "Your full seven-day schedule is waiting - guided workouts, recovery days, and protein guidance based on your answers.",
    "",
    `${"Open My Plan"}: ${returnUrl}`,
    "",
    "The link opens the same saved plan and brings back your latest progress on any device. No password needed.",
    "",
    "Start Day 1 when you're ready.",
    "",
    "Move or Rust.",
    "",
    "Todd",
    "Gen X Jumps",
    "",
    "---",
    PLAN_READY_FOOTER,
    `Manage email preferences: ${preferencesUrl}`,
    "",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(PLAN_READY_PREVIEW_TEXT)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;text-align:left;">
<tr><td>
<p style="margin:0 0 16px 0;">Hey ${escapeHtml(greetingName)},</p>
<p style="margin:0 0 16px 0;">Your personalized 7-Day Comeback Plan is ready.</p>
<p style="margin:0 0 24px 0;">Your full seven-day schedule is waiting - guided workouts, recovery days, and protein guidance based on your answers.</p>
<p style="margin:0 0 24px 0;">
<a href="${escapeHtml(returnUrl)}" style="display:inline-block;padding:14px 24px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;">${PLAN_READY_CTA_LABEL}</a>
</p>
<p style="margin:0 0 16px 0;">The link opens the same saved plan and brings back your latest progress on any device. No password needed.</p>
<p style="margin:0 0 16px 0;">Start Day 1 when you're ready.</p>
<p style="margin:0 0 16px 0;">Move or Rust.</p>
<p style="margin:0 0 24px 0;">Todd<br />Gen X Jumps</p>
<p style="margin:0 0 8px 0;font-size:13px;color:#555555;">Or open this link directly:<br /><a href="${escapeHtml(returnUrl)}" style="color:#555555;">${escapeHtml(returnUrl)}</a></p>
<hr style="border:none;border-top:1px solid #dddddd;margin:24px 0;" />
<p style="margin:0 0 8px 0;font-size:12px;color:#666666;">${escapeHtml(PLAN_READY_FOOTER)}</p>
<p style="margin:0;font-size:12px;color:#666666;"><a href="${escapeHtml(preferencesUrl)}" style="color:#666666;">Manage email preferences</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { subject, previewText: PLAN_READY_PREVIEW_TEXT, html, text, personalizedName: name };
}

/** Values that must never appear in a Plan Ready payload. Used by tests and guards. */
export const PROHIBITED_TEMPLATE_PATTERNS: RegExp[] = [
  /accelerator/i,
  /\$\d/,
  /\bprice\b/i,
  /\bupsell\b/i,
  /\bgrams?\b/i,
  /\bprotein target\b/i,
  /\bW0[1-7]\b/,
  /affiliate/i,
];
