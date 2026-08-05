// Locked Halfway (halfway_v1) message template. Pure and deterministic: no IO,
// no environment reads, no database access, no provider calls, no request or URL
// reads. Inputs are never mutated. A CANCEL resolution is never renderable.
import { PLAN_READY_FOOTER, sanitizeFirstName } from "@/lib/email/plan-ready-template";
import type { HalfwayResolution } from "@/lib/email/halfway-resolver";

/** App-owned footer, shared verbatim with Plan Ready and Start Day 1. */
export const HALFWAY_FOOTER = PLAN_READY_FOOTER;

export const HALFWAY_GREETING_FALLBACK = "Hey there,";

export const HALFWAY_PREVIEW_TEXT = "Three days left. Keep the momentum.";

export const HALFWAY_FALLBACK_SUBJECT = "You are halfway through your 7-Day Comeback Plan";

export const HALFWAY_CTA_LABEL = "Continue My Plan";

export type HalfwayRenderInput = {
  firstName: string | null | undefined;
  /** Existing absolute opaque secure return URL on the app origin. */
  returnUrl: string;
  /** Absolute purpose-limited email-preferences URL on the app origin. */
  preferencesUrl: string;
};

export type HalfwayRendered = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  /** Sanitized greeting name, or null when the fallback greeting is used. */
  personalizedName: string | null;
  ctaLabel: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Ordered body paragraphs, CTA excluded. */
export function halfwayBodyParagraphs(greeting: string): string[] {
  return [
    greeting,
    "You are four days into your 7-Day Comeback Plan.",
    "That is the part most people never get to.",
    "Three days left.",
    "Keep the momentum going. Open your plan and take the next day exactly as it is written. Work hard, rest when needed, and scale things when you need to.",
    "You are closer to the finish than the start.",
  ];
}

const SIGN_OFF = ["Move or Rust.", "Todd", "Gen X Jumps"] as const;

function subjectFor(name: string | null): string {
  return name ? `${name}, you are halfway there` : HALFWAY_FALLBACK_SUBJECT;
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

  const paragraphs = halfwayBodyParagraphs(greeting);
  const returnUrl = input.returnUrl;
  const preferencesUrl = input.preferencesUrl;

  const text = [
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    `${ctaLabel}: ${returnUrl}`,
    "",
    ...SIGN_OFF.flatMap((line, index) => (index === 0 ? [line, ""] : [line])),
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
  };
}
