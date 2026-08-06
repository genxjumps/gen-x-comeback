// Locked Stalled (stalled_v1) message template. Pure and deterministic: no IO,
// no environment reads, no database access, no provider calls, no request or URL
// reads. Inputs are never mutated. Only a SEND resolution is renderable.
//
// Copy is the approved Technical Specification 7.10.2 copy, verbatim. No
// promotional content, no Accelerator content, no plan id, no email address, no
// progress or workout number, and no destination parameter ever appears.
import { PLAN_READY_FOOTER, sanitizeFirstName } from "@/lib/email/plan-ready-template";
import type { StalledResolution } from "@/lib/email/stalled-resolver";

/** App-owned footer, shared verbatim with Plan Ready, Start Day 1, and Halfway. */
export const STALLED_FOOTER = PLAN_READY_FOOTER;

export const STALLED_GREETING_FALLBACK = "Hey there,";

export const STALLED_PREVIEW_TEXT =
  "You haven\u2019t lost your progress. Pick up where you left off.";

export const STALLED_FALLBACK_SUBJECT = "Your plan is still waiting";

export const STALLED_CTA_LABEL = "Continue My Plan";

/** Ordered approved body paragraphs, greeting/CTA/close excluded. */
export const STALLED_BODY_PARAGRAPHS = [
  "Life gets busy.",
  "You\u2019ve already made progress, and your plan is still right where you left it.",
  "You don\u2019t need to restart. Just come back and complete the next workout.",
] as const;

export const STALLED_SIGN_OFF = ["Move or Rust.", "Todd", "Gen X Jumps"] as const;

/** Visually secondary recovery line placed after the signature, before the footer. */
export const STALLED_RECOVERY_LINE_PREFIX = "Lost access to your plan?";
export const STALLED_RECOVERY_LINK_TEXT = "Recover it here";
export const STALLED_RECOVERY_LINE_SUFFIX = "and pick up where you left off.";
export const STALLED_RECOVERY_LINE = `${STALLED_RECOVERY_LINE_PREFIX} ${STALLED_RECOVERY_LINK_TEXT} ${STALLED_RECOVERY_LINE_SUFFIX}`;

/** Token-free recovery path. The route itself is intentionally not implemented here. */
export const STALLED_RECOVERY_PATH = "/recover";

export type StalledRenderInput = {
  firstName: string | null | undefined;
  /** Existing absolute opaque secure return URL on the app origin. */
  returnUrl: string;
  /** Absolute purpose-limited email-preferences URL on the app origin. */
  preferencesUrl: string;
  /** Absolute app origin used to build the token-free /recover URL. */
  appOrigin?: string;
};

export type StalledRendered = {
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
  return name ? `${name}, your plan is still waiting` : STALLED_FALLBACK_SUBJECT;
}

/**
 * Derives the token-free absolute recovery URL from an absolute app origin.
 * No credential, token, identifier, or query string is ever appended.
 */
function recoveryUrlFor(returnUrl: string, appOrigin?: string): string {
  if (appOrigin) return `${appOrigin.replace(/\/+$/, "")}${STALLED_RECOVERY_PATH}`;
  try {
    return `${new URL(returnUrl).origin}${STALLED_RECOVERY_PATH}`;
  } catch {
    return STALLED_RECOVERY_PATH;
  }
}

/**
 * Renders the Stalled message for a resolver result.
 * Returns null for anything other than SEND: a canceled, suppressed, or
 * deferred job can never produce a sendable message.
 */
export function renderStalled(
  resolution: StalledResolution,
  input: StalledRenderInput,
): StalledRendered | null {
  if (resolution.action !== "SEND") return null;

  const name = sanitizeFirstName(input.firstName);
  const greeting = name ? `Hey ${name},` : STALLED_GREETING_FALLBACK;
  const previewText = STALLED_PREVIEW_TEXT;
  const ctaLabel = STALLED_CTA_LABEL;
  const subject = subjectFor(name);

  const returnUrl = input.returnUrl;
  const preferencesUrl = input.preferencesUrl;
  const recoveryUrl = recoveryUrlFor(returnUrl, input.appOrigin);
  const paragraphs = [greeting, ...STALLED_BODY_PARAGRAPHS];

  const text = [
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    `${ctaLabel}: ${returnUrl}`,
    "",
    ...STALLED_SIGN_OFF.flatMap((line, index) => (index === 0 ? [line, ""] : [line])),
    "",
    `${STALLED_RECOVERY_LINE} ${recoveryUrl}`,
    "",
    "---",
    STALLED_FOOTER,
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
<p style="margin:0 0 8px 0;font-size:13px;color:#666666;">${escapeHtml(STALLED_RECOVERY_LINE_PREFIX)} <a href="${escapeHtml(recoveryUrl)}" style="color:#666666;">${escapeHtml(STALLED_RECOVERY_LINK_TEXT)}</a> ${escapeHtml(STALLED_RECOVERY_LINE_SUFFIX)}</p>
<hr style="border:none;border-top:1px solid #dddddd;margin:24px 0;" />
<p style="margin:0 0 8px 0;font-size:12px;color:#666666;">${escapeHtml(STALLED_FOOTER)}</p>
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
