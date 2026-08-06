// Locked Plan Completed (plan_completed_v1) message template. Pure and
// deterministic: no IO, no environment reads, no database access, no provider
// calls, no request or URL reads. Inputs are never mutated. Only a SEND
// resolution is renderable.
//
// Copy is the approved Plan Completed copy, verbatim. No Accelerator promotion,
// no sales copy, no countdown language, no assessment answers, no weight or
// protein data, no detailed progress data, no email address, no visible token
// data, and never the word "assignment".
import { PLAN_READY_FOOTER, sanitizeFirstName } from "@/lib/email/plan-ready-template";
import {
  STALLED_RECOVERY_LINE_PREFIX,
  STALLED_RECOVERY_LINE_SUFFIX,
  STALLED_RECOVERY_LINK_TEXT,
  STALLED_RECOVERY_PATH,
} from "@/lib/email/stalled-template";
import type { PlanCompletedResolution } from "@/lib/email/plan-completed-resolver";

/** App-owned footer, shared verbatim with every other lifecycle message. */
export const PLAN_COMPLETED_FOOTER = PLAN_READY_FOOTER;

export const PLAN_COMPLETED_GREETING_FALLBACK = "Hey there,";

export const PLAN_COMPLETED_PREVIEW_TEXT = "You finished what you started.";

export const PLAN_COMPLETED_FALLBACK_SUBJECT = "You completed your 7-day plan";

export const PLAN_COMPLETED_CTA_LABEL = "View My Completed Plan";

export const PLAN_COMPLETED_POST_CTA_LINE = "Keep moving. Keep rebuilding. Stay capable.";

/** Ordered approved body paragraphs; greeting, CTA and close excluded. */
export const PLAN_COMPLETED_BODY_PARAGRAPHS = [
  "You did it. You completed every day in your 7-Day Comeback Plan.",
  "That means you worked, recovered, and kept coming back until the plan was done.",
  "Perfect wasn\u2019t required. You finished.",
] as const;

export const PLAN_COMPLETED_SIGN_OFF = ["Move or Rust.", "Todd", "Gen X Jumps"] as const;

/** Established token-free recovery-footer pattern, reused verbatim. */
export const PLAN_COMPLETED_RECOVERY_LINE_PREFIX = STALLED_RECOVERY_LINE_PREFIX;
export const PLAN_COMPLETED_RECOVERY_LINK_TEXT = STALLED_RECOVERY_LINK_TEXT;
export const PLAN_COMPLETED_RECOVERY_LINE_SUFFIX = STALLED_RECOVERY_LINE_SUFFIX;
export const PLAN_COMPLETED_RECOVERY_LINE = `${PLAN_COMPLETED_RECOVERY_LINE_PREFIX} ${PLAN_COMPLETED_RECOVERY_LINK_TEXT} ${PLAN_COMPLETED_RECOVERY_LINE_SUFFIX}`;
export const PLAN_COMPLETED_RECOVERY_PATH = STALLED_RECOVERY_PATH;

/** Personalized subject builder for a sanitized safe name. */
export function planCompletedSubject(firstName: string): string {
  return `${firstName}, you completed your 7-day plan`;
}

export type PlanCompletedRenderInput = {
  firstName: string | null | undefined;
  /** Existing absolute opaque secure return URL on the app origin. */
  returnUrl: string;
  /** Absolute purpose-limited email-preferences URL on the app origin. */
  preferencesUrl: string;
  /** Absolute app origin used to build the token-free recovery URL. */
  appOrigin?: string;
};

export type PlanCompletedRendered = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  /** Sanitized greeting name, or null when the fallback greeting is used. */
  personalizedName: string | null;
  ctaLabel: string;
  postCtaLine: string;
  /** Absolute token-free recovery URL used in both HTML and plain text. */
  recoveryUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Derives the token-free absolute recovery URL from an absolute app origin.
 * No credential, token, identifier, or query string is ever appended.
 */
function recoveryUrlFor(returnUrl: string, appOrigin?: string): string {
  if (appOrigin) return `${appOrigin.replace(/\/+$/, "")}${PLAN_COMPLETED_RECOVERY_PATH}`;
  try {
    return `${new URL(returnUrl).origin}${PLAN_COMPLETED_RECOVERY_PATH}`;
  } catch {
    return PLAN_COMPLETED_RECOVERY_PATH;
  }
}

/**
 * Renders the Plan Completed message for a resolver result.
 * Returns null for anything other than SEND: a canceled, suppressed, or
 * deferred job can never produce a sendable message.
 */
export function renderPlanCompleted(
  resolution: PlanCompletedResolution,
  input: PlanCompletedRenderInput,
): PlanCompletedRendered | null {
  if (resolution.action !== "SEND") return null;

  const name = sanitizeFirstName(input.firstName);
  const greeting = name ? `Hey ${name},` : PLAN_COMPLETED_GREETING_FALLBACK;
  const subject = name ? planCompletedSubject(name) : PLAN_COMPLETED_FALLBACK_SUBJECT;

  const returnUrl = input.returnUrl;
  const preferencesUrl = input.preferencesUrl;
  const recoveryUrl = recoveryUrlFor(returnUrl, input.appOrigin);
  const paragraphs = [greeting, ...PLAN_COMPLETED_BODY_PARAGRAPHS];

  const text = [
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    `${PLAN_COMPLETED_CTA_LABEL}: ${returnUrl}`,
    "",
    PLAN_COMPLETED_POST_CTA_LINE,
    "",
    ...PLAN_COMPLETED_SIGN_OFF.flatMap((line, index) => (index === 0 ? [line, ""] : [line])),
    "",
    `${PLAN_COMPLETED_RECOVERY_LINE} ${recoveryUrl}`,
    "",
    "---",
    PLAN_COMPLETED_FOOTER,
    `Manage email preferences: ${preferencesUrl}`,
    "",
  ].join("\n");

  const bodyHtml = paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px 0;">${escapeHtml(paragraph)}</p>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(PLAN_COMPLETED_PREVIEW_TEXT)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;text-align:left;">
<tr><td>
${bodyHtml}
<p style="margin:0 0 24px 0;">
<a href="${escapeHtml(returnUrl)}" style="display:inline-block;padding:14px 24px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;">${escapeHtml(PLAN_COMPLETED_CTA_LABEL)}</a>
</p>
<p style="margin:0 0 16px 0;">${escapeHtml(PLAN_COMPLETED_POST_CTA_LINE)}</p>
<p style="margin:0 0 16px 0;">Move or Rust.</p>
<p style="margin:0 0 24px 0;">Todd<br />Gen X Jumps</p>
<p style="margin:0 0 8px 0;font-size:13px;color:#555555;">Or open this link directly:<br /><a href="${escapeHtml(returnUrl)}" style="color:#555555;">${escapeHtml(returnUrl)}</a></p>
<p style="margin:0 0 8px 0;font-size:13px;color:#666666;">${escapeHtml(PLAN_COMPLETED_RECOVERY_LINE_PREFIX)} <a href="${escapeHtml(recoveryUrl)}" style="color:#666666;">${escapeHtml(PLAN_COMPLETED_RECOVERY_LINK_TEXT)}</a> ${escapeHtml(PLAN_COMPLETED_RECOVERY_LINE_SUFFIX)}</p>
<hr style="border:none;border-top:1px solid #dddddd;margin:24px 0;" />
<p style="margin:0 0 8px 0;font-size:12px;color:#666666;">${escapeHtml(PLAN_COMPLETED_FOOTER)}</p>
<p style="margin:0;font-size:12px;color:#666666;"><a href="${escapeHtml(preferencesUrl)}" style="color:#666666;">Manage email preferences</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return {
    subject,
    previewText: PLAN_COMPLETED_PREVIEW_TEXT,
    html,
    text,
    personalizedName: name,
    ctaLabel: PLAN_COMPLETED_CTA_LABEL,
    postCtaLine: PLAN_COMPLETED_POST_CTA_LINE,
    recoveryUrl,
  };
}
