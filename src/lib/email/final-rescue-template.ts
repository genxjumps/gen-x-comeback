// Locked Final Rescue (final_rescue_v1) message template. Pure and
// deterministic: no IO, no environment reads, no database access, no provider
// calls, no request or URL reads. Inputs are never mutated. Only a SEND
// resolution is renderable.
//
// Copy is the approved Final Rescue copy, verbatim, in two approved variants.
// No guilt or shame, no countdown language, no Accelerator promotion, no
// assessment answers, no weight or protein data, no detailed progress, no email
// address, no visible token data, and never the word "assignment".
import { PLAN_READY_FOOTER, sanitizeFirstName } from "@/lib/email/plan-ready-template";
import {
  STALLED_RECOVERY_LINE_PREFIX,
  STALLED_RECOVERY_LINE_SUFFIX,
  STALLED_RECOVERY_LINK_TEXT,
  STALLED_RECOVERY_PATH,
} from "@/lib/email/stalled-template";
import type { FinalRescueResolution, FinalRescueVariant } from "@/lib/email/final-rescue-resolver";

/** App-owned footer, shared verbatim with every other lifecycle message. */
export const FINAL_RESCUE_FOOTER = PLAN_READY_FOOTER;

export const FINAL_RESCUE_GREETING_FALLBACK = "Hey there,";

export const FINAL_RESCUE_SIGN_OFF = ["Move or Rust.", "Todd", "Gen X Jumps"] as const;

/** Established token-free recovery-footer pattern, reused verbatim. */
export const FINAL_RESCUE_RECOVERY_LINE_PREFIX = STALLED_RECOVERY_LINE_PREFIX;
export const FINAL_RESCUE_RECOVERY_LINK_TEXT = STALLED_RECOVERY_LINK_TEXT;
export const FINAL_RESCUE_RECOVERY_LINE_SUFFIX = STALLED_RECOVERY_LINE_SUFFIX;
export const FINAL_RESCUE_RECOVERY_LINE = `${FINAL_RESCUE_RECOVERY_LINE_PREFIX} ${FINAL_RESCUE_RECOVERY_LINK_TEXT} ${FINAL_RESCUE_RECOVERY_LINE_SUFFIX}`;
export const FINAL_RESCUE_RECOVERY_PATH = STALLED_RECOVERY_PATH;

/** The one approved copy set per variant. */
export type FinalRescueVariantCopy = {
  /** Personalized subject builder. */
  subject: (firstName: string) => string;
  fallbackSubject: string;
  previewText: string;
  /** Ordered approved body paragraphs; greeting, CTA and close excluded. */
  bodyParagraphs: readonly string[];
  ctaLabel: string;
  postCtaLine: string;
};

export const FINAL_RESCUE_COPY: Record<FinalRescueVariant, FinalRescueVariantCopy> = {
  unstarted: {
    subject: (firstName) => `${firstName}, your 7-day plan is still waiting`,
    fallbackSubject: "Your 7-day plan is still waiting",
    previewText: "Come back to your plan and start Day 1 when you\u2019re ready.",
    bodyParagraphs: [
      "Your 7-Day Comeback Plan is still here.",
      "You don\u2019t need to catch up or start over. Open your plan and start Day 1 when you\u2019re ready.",
    ],
    ctaLabel: "Open My Plan",
    postCtaLine: "One workout. One decision. Get moving again.",
  },
  started: {
    subject: (firstName) => `${firstName}, pick up where you left off`,
    fallbackSubject: "Pick up where you left off",
    previewText: "Your plan and progress are saved.",
    bodyParagraphs: [
      "You started your 7-Day Comeback Plan, but it\u2019s been a few days since you completed a day in your plan.",
      "Your progress is saved. You don\u2019t need to restart or make up missed days. Open your plan and complete the next day.",
    ],
    ctaLabel: "Return to My Plan",
    postCtaLine: "The next step is the only one that matters.",
  },
};

export type FinalRescueRenderInput = {
  firstName: string | null | undefined;
  /** Existing absolute opaque secure return URL on the app origin. */
  returnUrl: string;
  /** Absolute purpose-limited email-preferences URL on the app origin. */
  preferencesUrl: string;
  /** Absolute app origin used to build the token-free recovery URL. */
  appOrigin?: string;
};

export type FinalRescueRendered = {
  variant: FinalRescueVariant;
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
  if (appOrigin) return `${appOrigin.replace(/\/+$/, "")}${FINAL_RESCUE_RECOVERY_PATH}`;
  try {
    return `${new URL(returnUrl).origin}${FINAL_RESCUE_RECOVERY_PATH}`;
  } catch {
    return FINAL_RESCUE_RECOVERY_PATH;
  }
}

/**
 * Renders the Final Rescue message for a resolver result.
 * Returns null for anything other than SEND: a canceled, suppressed, or
 * deferred job can never produce a sendable message. The variant comes only
 * from the resolver, which derives it from persisted state.
 */
export function renderFinalRescue(
  resolution: FinalRescueResolution,
  input: FinalRescueRenderInput,
): FinalRescueRendered | null {
  if (resolution.action !== "SEND") return null;

  const copy = FINAL_RESCUE_COPY[resolution.variant];
  const name = sanitizeFirstName(input.firstName);
  const greeting = name ? `Hey ${name},` : FINAL_RESCUE_GREETING_FALLBACK;
  const subject = name ? copy.subject(name) : copy.fallbackSubject;
  const previewText = copy.previewText;
  const ctaLabel = copy.ctaLabel;

  const returnUrl = input.returnUrl;
  const preferencesUrl = input.preferencesUrl;
  const recoveryUrl = recoveryUrlFor(returnUrl, input.appOrigin);
  const paragraphs = [greeting, ...copy.bodyParagraphs];

  const text = [
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    `${ctaLabel}: ${returnUrl}`,
    "",
    copy.postCtaLine,
    "",
    ...FINAL_RESCUE_SIGN_OFF.flatMap((line, index) => (index === 0 ? [line, ""] : [line])),
    "",
    `${FINAL_RESCUE_RECOVERY_LINE} ${recoveryUrl}`,
    "",
    "---",
    FINAL_RESCUE_FOOTER,
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
<p style="margin:0 0 16px 0;">${escapeHtml(copy.postCtaLine)}</p>
<p style="margin:0 0 16px 0;">Move or Rust.</p>
<p style="margin:0 0 24px 0;">Todd<br />Gen X Jumps</p>
<p style="margin:0 0 8px 0;font-size:13px;color:#555555;">Or open this link directly:<br /><a href="${escapeHtml(returnUrl)}" style="color:#555555;">${escapeHtml(returnUrl)}</a></p>
<p style="margin:0 0 8px 0;font-size:13px;color:#666666;">${escapeHtml(FINAL_RESCUE_RECOVERY_LINE_PREFIX)} <a href="${escapeHtml(recoveryUrl)}" style="color:#666666;">${escapeHtml(FINAL_RESCUE_RECOVERY_LINK_TEXT)}</a> ${escapeHtml(FINAL_RESCUE_RECOVERY_LINE_SUFFIX)}</p>
<hr style="border:none;border-top:1px solid #dddddd;margin:24px 0;" />
<p style="margin:0 0 8px 0;font-size:12px;color:#666666;">${escapeHtml(FINAL_RESCUE_FOOTER)}</p>
<p style="margin:0;font-size:12px;color:#666666;"><a href="${escapeHtml(preferencesUrl)}" style="color:#666666;">Manage email preferences</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return {
    variant: resolution.variant,
    subject,
    previewText,
    html,
    text,
    personalizedName: name,
    ctaLabel,
    postCtaLine: copy.postCtaLine,
    recoveryUrl,
  };
}
