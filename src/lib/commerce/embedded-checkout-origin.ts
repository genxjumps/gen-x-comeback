const PRODUCTION_WEBSITE_ORIGIN = "https://genxjumps.com";

export function embeddedCheckoutAttemptLimit(origin: string): number {
  return origin === PRODUCTION_WEBSITE_ORIGIN ? 20 : 100;
}

function normalizedHttpsOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function allowedEmbeddedCheckoutOrigin(
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
): string | null {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!origin) return null;
  if (origin === PRODUCTION_WEBSITE_ORIGIN) return origin;

  const configured = (environment.CHECKOUT_WEBSITE_ORIGINS ?? "")
    .split(",")
    .map((value) => normalizedHttpsOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));
  if (configured.includes(origin)) return origin;

  if (
    environment.NODE_ENV !== "production" &&
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  ) {
    return origin;
  }
  return null;
}
