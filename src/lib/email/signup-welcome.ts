export function renderSignupWelcome(returnUrl: string) {
  // Identical payload across retries, independent of changing participant state.
  // The secure destination resolves the current state when deliberately opened.
  const subject = "Your Gen X Jumps access is saved";
  const text = `You're in.\n\nUse your secure link to finish setting up your free 7-Day Plan or return to the plan you've already saved.\n\nContinue My Plan: ${returnUrl}\n\nIf you're switching devices before finishing setup, you'll answer the short assessment again. If your plan is already saved, your progress stays with it.\n\nThis link works for 30 days.\n\nTodd\nGen X Jumps`;
  const escaped = returnUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return {
    subject,
    previewText: "Finish setup or pick up your saved plan.",
    text,
    html: `<p>You're in.</p><p>Use your secure link to finish setting up your free 7-Day Plan or return to the plan you've already saved.</p><p><a href="${escaped}">Continue My Plan</a></p><p>If you're switching devices before finishing setup, you'll answer the short assessment again. If your plan is already saved, your progress stays with it.</p><p>This link works for 30 days.</p><p>Todd<br>Gen X Jumps</p>`,
  };
}
export function welcomeRetryDecision(
  attemptCount: number,
  firstAttemptAt: string | null,
  now: Date,
): "send" | "stop" {
  return attemptCount > 6 ||
    (firstAttemptAt !== null && now.getTime() - new Date(firstAttemptAt).getTime() >= 23 * 3600000)
    ? "stop"
    : "send";
}
