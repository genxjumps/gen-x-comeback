// Transactional paid-program access email. It contains no marketing,
// unsubscribe, progress, measurement, or nutrition content.

export const PAID_ACCESS_TEMPLATE_VERSION = "paid_access_v1";
export const PAID_PURCHASE_ACCESS_JOB_TYPE = "paid_purchase_access";
export const PAID_RECOVERY_JOB_TYPE = "paid_recovery";
export const PAID_ACCESS_JOB_VERSION = "v1";
export const PAID_ACCESS_CTA = "Open My Programs";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type PaidAccessEmailKind = "purchase" | "recovery";

export function renderPaidAccessEmail(input: { kind: PaidAccessEmailKind; returnUrl: string }) {
  const purchase = input.kind === "purchase";
  const subject = purchase
    ? "Your 28-Day Accelerator is ready"
    : "Your secure Gen X Jumps access link";
  const previewText = purchase
    ? "Your Accelerator is ready whenever you are."
    : "Sign in to your Gen X Jumps account.";
  const opening = purchase
    ? "Your 28-Day Fat Loss Accelerator purchase is confirmed."
    : "Here’s the secure access link you requested.";
  const detail = purchase
    ? "You can use this email later or open it on another device. Your access does not expire."
    : "Use this link to sign in to your Gen X Jumps account on any device. No password needed.";
  const cta = purchase ? PAID_ACCESS_CTA : "Sign In";
  const footer = purchase
    ? "You received this transactional email because this address completed a Gen X Jumps purchase."
    : "You received this transactional email because a secure access link was requested for this address.";

  const text = [
    "Hey there,",
    "",
    opening,
    "",
    detail,
    "",
    `${cta}: ${input.returnUrl}`,
    "",
    "Move or Rust.",
    "",
    "Todd",
    "Gen X Jumps",
    "",
    "---",
    footer,
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
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;text-align:left;">
<tr><td>
<p style="margin:0 0 16px 0;">Hey there,</p>
<p style="margin:0 0 16px 0;">${escapeHtml(opening)}</p>
<p style="margin:0 0 24px 0;">${escapeHtml(detail)}</p>
<p style="margin:0 0 24px 0;"><a href="${escapeHtml(input.returnUrl)}" style="display:inline-block;padding:14px 24px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;">${cta}</a></p>
<p style="margin:0 0 16px 0;">Move or Rust.</p>
<p style="margin:0 0 24px 0;">Todd<br />Gen X Jumps</p>
<p style="margin:0 0 8px 0;font-size:13px;color:#555555;">Or open this link directly:<br /><a href="${escapeHtml(input.returnUrl)}" style="color:#555555;">${escapeHtml(input.returnUrl)}</a></p>
<hr style="border:none;border-top:1px solid #dddddd;margin:24px 0;" />
<p style="margin:0;font-size:12px;color:#666666;">${escapeHtml(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject, previewText, html, text };
}
