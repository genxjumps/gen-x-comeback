// Locked Halfway (halfway_v1) message template. Pure and deterministic: no IO,
// no environment reads, no database access, no provider calls, no request or URL
// reads. Inputs are never mutated. A CANCEL resolution is never renderable.
import { PLAN_READY_FOOTER, sanitizeFirstName } from "@/lib/email/plan-ready-template";
import type { HalfwayResolution } from "@/lib/email/halfway-resolver";

/** App-owned footer, shared verbatim with Plan Ready and Start Day 1. */
export const HALFWAY_FOOTER = PLAN_READY_FOOTER;

export const HALFWAY_GREETING_FALLBACK = "Hey there,";

export const HALFWAY_PREVIEW_TEXT = "Keep going. Your comeback is already taking shape.";

export const HALFWAY_FALLBACK_SUBJECT = "You're building real momentum";

export const HALFWAY_CTA_LABEL = "Continue My Plan";

/** Ordered approved body paragraphs, greeting/CTA/close excluded. */
export const HALFWAY_BODY_PARAGRAPHS = [
  "You've already completed several workouts.",
  "That's more than most people ever do.",
  "You're building strength, improving your conditioning, and proving you can stay consistent.",
  "Keep showing up. The finish line is getting closer.",
] as const;

export const HALFWAY_SIGN_OFF = ["Move or Rust.", "Todd", "Gen X Jumps"] as const;

/** Visually secondary recovery line placed before the standard footer. */
export const HALFWAY_RECOVERY_LINE_PREFIX = "Lost access to your plan?";
export const HALFWAY_RECOVERY_LINK_TEXT = "Recover it here";
export const HALFWAY_RECOVERY_LINE_SUFFIX = "and pick up where you left off.";
export const HALFWAY_RECOVERY_LINE = `${HALFWAY_RECOVERY_LINE_PREFIX} ${HALFWAY_RECOVERY_LINK_TEXT} ${HALFWAY_RECOVERY_LINE_SUFFIX}`;

/** Token-free recovery path. The route itself is intentionally not implemented here. */
export const HALFWAY_RECOVERY_PATH = "/recover";

export type HalfwayRenderInput = {
  firstName: string | null | undefined;
  /** Existing absolute opaque secure return URL on the app origin. */
  returnUrl: string;
  /** Absolute purpose-limited email-preferences URL on the app origin. */
  preferencesUrl: string;
  /** Absolute app origin used to build the token-free /recover URL. */
  appOrigin?: string;
};

export type HalfwayRendered = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  /** Sanitized greeting name, or null when the fallback greeting is used. */
  personalizedName: string | null;
  ctaLabel: string;
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

function subjectFor(name: string | null): string {
  return name ? `${name}, you're building real momentum` : HALFWAY_FALLBACK_SUBJECT;
}

/**
 * Derives the token-free absolute recovery URL from an absolute app origin.
 * No credential, token, identifier, or query string is ever appended.
 */
function recoveryUrlFor(returnUrl: string, appOrigin?: string): string {
  if (appOrigin) return `${appOrigin.replace(/\/+$/, "")}${HALFWAY_RECOVERY_PATH}`;
  try {
    return `${new URL(returnUrl).origin}${HALFWAY_RECOVERY_PATH}`;
  } catch {
    return HALFWAY_RECOVERY_PATH;
  }
}

/**
 * Renders the Halfway message for a resolver result.
 * Returns null for CANCEL: a canceled job can never produce a sendable message.
 */
export function renderHalfway(
  resolution: HalfwayResolution,
  input: HalfwayRenderInput,
): HalfwayRendered | null {
  if (resolution.action !== "SEND") return null;

  const name = sanitizeFirstName(input.firstName);
  const greeting = name ? `Hey ${name},` : HALFWAY_GREETING_FALLBACK;
  const previewText = HALFWAY_PREVIEW_TEXT;
  const ctaLabel = HALFWAY_CTA_LABEL;
  const subject = subjectFor(name);

  const returnUrl = input.returnUrl;
  const preferencesUrl = input.preferencesUrl;
  const recoveryUrl = recoveryUrlFor(returnUrl, input.appOrigin);
  const paragraphs = [greeting, ...HALFWAY_BODY_PARAGRAPHS];

  const text = [
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    `${ctaLabel}: ${returnUrl}`,
    "",
    ...HALFWAY_SIGN_OFF.flatMap((line, index) => (index === 0 ? [line, ""] : [line])),
    "",
    `${HALFWAY_RECOVERY_LINE} ${recoveryUrl}`,
    "",
    "---",
    HALFWAY_FOOTER,
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
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;text-align:left;">
<tr><td>
${bodyHtml}
<p style="margin:0 0 24px 0;">
<a href="${escapeHtml(returnUrl)}" style="display:inline-block;padding:14px 24px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;">${escapeHtml(ctaLabel)}</a>
</p>
<p style="margin:0 0 16px 0;">Move or Rust.</p>
<p style="margin:0 0 24px 0;">Todd<br />Gen X Jumps</p>
<p style="margin:0 0 8px 0;font-size:13px;color:#555555;">Or open this link directly:<br /><a href="${escapeHtml(returnUrl)}" style="color:#555555;">${escapeHtml(returnUrl)}</a></p>
<p style="margin:0 0 8px 0;font-size:13px;color:#666666;">${escapeHtml(HALFWAY_RECOVERY_LINE_PREFIX)} <a href="${escapeHtml(recoveryUrl)}" style="color:#666666;">${escapeHtml(HALFWAY_RECOVERY_LINK_TEXT)}</a> ${escapeHtml(HALFWAY_RECOVERY_LINE_SUFFIX)}</p>
<hr style="border:none;border-top:1px solid #dddddd;margin:24px 0;" />
<p style="margin:0 0 8px 0;font-size:12px;color:#666666;">${escapeHtml(HALFWAY_FOOTER)}</p>
<p style="margin:0;font-size:12px;color:#666666;"><a href="${escapeHtml(preferencesUrl)}" style="color:#666666;">Manage email preferences</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return {
    subject,
    previewText,
    html,
    text,
    personalizedName: name,
    ctaLabel,
    recoveryUrl,
  };
}
