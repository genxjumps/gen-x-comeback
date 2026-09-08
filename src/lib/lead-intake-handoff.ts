import { z } from "zod";

export const LEAD_INTAKE_COOKIE = "gxj_lead_intake_v1";
export const LEAD_INTAKE_TTL_SECONDS = 24 * 60 * 60;
export const WEBSITE_INTAKE_ORIGIN = "https://genxjumps.com";

// eslint-disable-next-line no-control-regex -- reject markup and ASCII controls in names
const FIRST_NAME_RE = /^[^<>&"`\u0000-\u001f\u007f]{1,60}$/;

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
    z.string().max(max).nullable(),
  );

export const websiteLeadIntakeSchema = z.object({
  firstName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => FIRST_NAME_RE.test(value), "Invalid first name"),
  email: z
    .string()
    .transform((value) => value.trim())
    .refine(
      (value) => z.string().email().max(254).safeParse(value).success,
      "Invalid email address",
    ),
  consentGranted: z.literal("true"),
  source: z.enum(["website_hero", "app_signup"]).default("website_hero"),
  landingPath: optionalText(500),
  referrerOrigin: optionalText(300),
  utmSource: optionalText(120),
  utmMedium: optionalText(120),
  utmCampaign: optionalText(160),
  utmContent: optionalText(160),
});

export const intakePlanInputSchema = z.object({
  submissionId: z.string().uuid("Invalid submission id"),
  sessionTokenHash: z.string().regex(/^[a-f0-9]{64}$/, "Invalid token hash"),
});

export function trustedLeadIntakeOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const requestOrigin = new URL(request.url).origin;
    if (origin === requestOrigin) return true;
    if (origin === WEBSITE_INTAKE_ORIGIN) return true;
    const configured = process.env["WEBSITE_ORIGIN"];
    if (configured && origin === new URL(configured).origin) return true;
    return process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin);
  } catch {
    return false;
  }
}

export function leadIntakeCookie(rawToken: string, maxAge: number, secure = true): string {
  return [
    `${LEAD_INTAKE_COOKIE}=${rawToken}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    secure ? "Secure" : "",
    "HttpOnly",
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}
