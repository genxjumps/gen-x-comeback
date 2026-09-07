import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";
import {
  LEAD_INTAKE_STORAGE_KEY,
  parseLeadIntakeDraft,
} from "@/lib/lead-intake-draft";

const ASSESSMENT_START_PATH = "/assessment/start";
const FALLBACK_SIGNUP_PATH = "/start/7-day";

const NO_STORE_HEADERS = {
  "cache-control": "no-store, max-age=0",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlResponse(body: string, status: number, nonce?: string): Response {
  const scriptPolicy = nonce ? `script-src 'nonce-${nonce}'` : "script-src 'none'";
  return new Response(`<!doctype html><html lang="en">${body}</html>`, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        `default-src 'none'; ${scriptPolicy}; style-src 'unsafe-inline'; ` +
        "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

function messagePage(title: string, message: string, status: number): Response {
  return htmlResponse(
    `<head><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escapeHtml(title)} | Gen X Jumps</title></head>` +
      `<body style="margin:0;background:#09090b;color:#f7f2e8;font:16px/1.55 system-ui,sans-serif">` +
      `<main style="max-width:36rem;margin:0 auto;padding:4rem 1.25rem">` +
      `<h1 style="font-size:2rem;line-height:1.1">${escapeHtml(title)}</h1>` +
      `<p>${escapeHtml(message)}</p>` +
      `<p><a style="color:#f4bb76" href="${FALLBACK_SIGNUP_PATH}">Return to the signup form</a></p>` +
      `</main></body>`,
    status,
  );
}

function nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Accepts the first-party website form without placing name or email in a URL.
 * The response stores the validated opt-in draft on the app origin, clears the
 * one-use transfer page from browser history, and starts the existing intake.
 * No lead or MailerLite subscriber is created until the completed assessment
 * is saved through the app's existing consent-gated enrollment transaction.
 */
export async function handleLeadIntakeHandoff(request: Request): Promise<Response> {
  if (!NEW_PLAN_INTAKE_OPEN) {
    return messagePage(
      "New plans are not open yet",
      "We could not start a new 7-Day Comeback Plan right now.",
      503,
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded")) {
    return messagePage("That signup did not work", "Return to the form and try again.", 415);
  }

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return messagePage("That signup did not work", "Return to the form and try again.", 400);
  }

  const draft = parseLeadIntakeDraft({
    firstName: data.get("firstName"),
    email: data.get("email"),
    consentGranted: data.get("consentGranted") === "true" ? true : false,
  });

  if (!draft) {
    return messagePage(
      "Check your signup details",
      "Enter a first name and valid email address, then try again.",
      400,
    );
  }

  const scriptNonce = nonce();
  const storageKey = JSON.stringify(LEAD_INTAKE_STORAGE_KEY);
  const serializedDraft = JSON.stringify(JSON.stringify(draft)).replaceAll("<", "\\u003c");
  const destination = JSON.stringify(ASSESSMENT_START_PATH);
  const fallback = JSON.stringify(FALLBACK_SIGNUP_PATH);

  return htmlResponse(
    `<head><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Opening Your 7-Day Comeback Plan | Gen X Jumps</title></head>` +
      `<body style="margin:0;background:#09090b;color:#f7f2e8;font:16px/1.55 system-ui,sans-serif">` +
      `<main style="max-width:36rem;margin:0 auto;padding:4rem 1.25rem">` +
      `<h1 style="font-size:2rem;line-height:1.1">Opening Your 7-Day Comeback Plan</h1>` +
      `<p>Taking you to the first step now.</p>` +
      `</main><script nonce="${scriptNonce}">` +
      `try{sessionStorage.setItem(${storageKey},${serializedDraft});` +
      `location.replace(${destination})}catch{location.replace(${fallback})}` +
      `</script></body>`,
    200,
    scriptNonce,
  );
}
