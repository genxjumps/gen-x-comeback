// Locked Start Day 1 (start_day_1_v1) message template for the two sendable
// resolver actions. Pure and deterministic: no IO, no environment reads, no
// database access, no provider calls, no request or URL reads. Inputs are
// never mutated. A CANCEL resolution is never renderable.
import { PLAN_READY_FOOTER, sanitizeFirstName } from "@/lib/email/plan-ready-template";
import type { StartDayOneResolution } from "@/lib/email/start-day-1-resolver";

/** App-owned footer, shared verbatim with Plan Ready. */
export const START_DAY_1_FOOTER = PLAN_READY_FOOTER;

export const START_DAY_1_GREETING_FALLBACK = "Hey there,";

export const START_DAY_1_START_PREVIEW_TEXT = "Your first workout is waiting.";
export const START_DAY_1_RESUME_PREVIEW_TEXT = "Pick up where you left off.";

export const START_DAY_1_START_FALLBACK_SUBJECT = "Day 1: Full Body Flush & Fire";
export const START_DAY_1_RESUME_FALLBACK_SUBJECT = "Finish Day 1: Full Body Flush & Fire";

export const START_DAY_1_START_CTA_LABEL = "Start Day 1";
export const START_DAY_1_RESUME_CTA_LABEL = "Resume Day 1";

export type StartDayOneRenderVariant = "start" | "resume";

export type StartDayOneRenderInput = {
  firstName: string | null | undefined;
  /** Existing absolute opaque secure return URL on the app origin. */
  returnUrl: string;
  /** Absolute purpose-limited email-preferences URL on the app origin. */
  preferencesUrl: string;
};

export type StartDayOneRendered = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  /** Sanitized greeting name, or null when the fallback greeting is used. */
  personalizedName: string | null;
  renderVariant: StartDayOneRenderVariant;
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

/** Ordered body paragraphs for one variant, CTA excluded. */
export function startDayOneBodyParagraphs(
  variant: StartDayOneRenderVariant,
  greeting: string,
): string[] {
  if (variant === "resume") {
    return [
      greeting,
      "You already got Day 1 started. Now let\u2019s finish it.",
      "Day 1: Full Body Flush & Fire",
      "Your jump rope + total-body workout is waiting for you.",
      "You don\u2019t need to start over. Pick up where you left off, work hard, rest when needed, and scale things when you need to.",
      "Finish what you started.",
    ];
  }
  return [
    greeting,
    "You\u2019ve got your 7-Day Comeback Plan.",
    "Now it\u2019s time to start.",
    "Day 1: Full Body Flush & Fire",
    "Your first jump rope + total-body workout is ready.",
    "These workouts are supposed to challenge you. Work hard, rest when needed, and scale things when you need to.",
    "Don\u2019t overthink it. Start.",
  ];
}

const SIGN_OFF = ["Move or Rust.", "Todd", "Gen X Jumps"] as const;

function subjectFor(variant: StartDayOneRenderVariant, name: string | null): string {
  if (variant === "resume") {
    return name
      ? `${name}, finish Day 1: Full Body Flush & Fire`
      : START_DAY_1_RESUME_FALLBACK_SUBJECT;
  }
  return name ? `${name}, Day 1: Full Body Flush & Fire` : START_DAY_1_START_FALLBACK_SUBJECT;
}

/**
 * Renders the Start Day 1 message for a resolver result.
 * Returns null for CANCEL: a canceled job can never produce a sendable message.
 */
export function renderStartDayOne(
  resolution: StartDayOneResolution,
  input: StartDayOneRenderInput,
): StartDayOneRendered | null {
  if (resolution.action !== "START" && resolution.action !== "RESUME") return null;

  const variant: StartDayOneRenderVariant = resolution.action === "RESUME" ? "resume" : "start";
  const name = sanitizeFirstName(input.firstName);
  const greeting = name ? `Hey ${name},` : START_DAY_1_GREETING_FALLBACK;
  const previewText =
    variant === "resume" ? START_DAY_1_RESUME_PREVIEW_TEXT : START_DAY_1_START_PREVIEW_TEXT;
  const ctaLabel =
    variant === "resume" ? START_DAY_1_RESUME_CTA_LABEL : START_DAY_1_START_CTA_LABEL;
  const subject = subjectFor(variant, name);

  const paragraphs = startDayOneBodyParagraphs(variant, greeting);
  const returnUrl = input.returnUrl;
  const preferencesUrl = input.preferencesUrl;

  const text = [
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    `${ctaLabel}: ${returnUrl}`,
    "",
    ...SIGN_OFF.flatMap((line, index) => (index === 0 ? [line, ""] : [line])),
    "",
    "---",
    START_DAY_1_FOOTER,
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
<p style="margin:0 0 8px 0;font-size:12px;color:#666666;">${escapeHtml(START_DAY_1_FOOTER)}</p>
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
    renderVariant: variant,
    ctaLabel,
  };
}
