// Locked Recovery (recovery_v1) message template. Pure and deterministic: no
// environment reads, no provider calls, no database access.
//
// Recovery is on-demand product access. It therefore carries no Accelerator
// promotion, no marketing copy, no unsubscribe or marketing CTA, no assessment
// details, no weight or protein data, no detailed progress, and never the
// customer-facing word "assignment".
import { sanitizeFirstName } from "@/lib/email/plan-ready-template";

export const RECOVERY_PREVIEW_TEXT = "Open your saved plan and pick up where you left off.";
export const RECOVERY_FALLBACK_SUBJECT = "Here’s a fresh link to your 7-day plan";
export const RECOVERY_CTA_LABEL = "Open My Plan";
export const RECOVERY_FOOTER =
  "You received this because a fresh access link was requested for your Gen X Jumps plan.";

/** Personalized subject for a usable first name. */
export function recoverySubject(name: string | null): string {
  return name ? `${name}, here’s a fresh link to your 7-day plan` : RECOVERY_FALLBACK_SUBJECT;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type RecoveryRenderInput = {
  firstName: string | null | undefined;
  /** Absolute secure return URL on the app origin. */
  returnUrl: string;
};

export type RecoveryRendered = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  /** Sanitized greeting name, or null when the fallback greeting is used. */
  personalizedName: string | null;
};

export function renderRecovery(input: RecoveryRenderInput): RecoveryRendered {
  const name = sanitizeFirstName(input.firstName);
  const greetingName = name ?? "there";
  const subject = recoverySubject(name);
  const returnUrl = input.returnUrl;

  const text = [
    `Hey ${greetingName},`,
    "",
    "Here’s the fresh link you requested for your 7-Day Comeback Plan.",
    "",
    "Your plan and progress are still saved.",
    "",
    `${RECOVERY_CTA_LABEL}: ${returnUrl}`,
    "",
    "This link opens your current saved plan on any device. No password needed.",
    "",
    "Move or Rust.",
    "",
    "Todd",
    "Gen X Jumps",
    "",
    "---",
    RECOVERY_FOOTER,
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
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(RECOVERY_PREVIEW_TEXT)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;text-align:left;">
<tr><td>
<p style="margin:0 0 16px 0;">Hey ${escapeHtml(greetingName)},</p>
<p style="margin:0 0 16px 0;">Here’s the fresh link you requested for your 7-Day Comeback Plan.</p>
<p style="margin:0 0 24px 0;">Your plan and progress are still saved.</p>
<p style="margin:0 0 24px 0;">
<a href="${escapeHtml(returnUrl)}" style="display:inline-block;padding:14px 24px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;">${RECOVERY_CTA_LABEL}</a>
</p>
<p style="margin:0 0 16px 0;">This link opens your current saved plan on any device. No password needed.</p>
<p style="margin:0 0 16px 0;">Move or Rust.</p>
<p style="margin:0 0 24px 0;">Todd<br />Gen X Jumps</p>
<p style="margin:0 0 8px 0;font-size:13px;color:#555555;">Or open this link directly:<br /><a href="${escapeHtml(returnUrl)}" style="color:#555555;">${escapeHtml(returnUrl)}</a></p>
<hr style="border:none;border-top:1px solid #dddddd;margin:24px 0;" />
<p style="margin:0;font-size:12px;color:#666666;">${escapeHtml(RECOVERY_FOOTER)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { subject, previewText: RECOVERY_PREVIEW_TEXT, html, text, personalizedName: name };
}
