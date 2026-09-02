import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("verified secure-link member-session bridge", () => {
  it("derives a Supabase magic-link token only from the verified lead email", () => {
    const exchange = readSource("../return-exchange.server.ts");

    expect(exchange).toContain('select("id, plan_version_id, email_verified_at, email_original")');
    expect(exchange).toContain("authAdmin.generateLink");
    expect(exchange).toContain('type: "magiclink"');
    expect(exchange).toContain("email: lead.email_original");
    expect(exchange).toContain("authLink.properties.hashed_token");
    expect(exchange).toContain("platformAuthTokenHash");

    // The auth handoff stays after the existing return-session and verification
    // writes so rejected/replaced tokens cannot mint a platform login.
    expect(exchange.indexOf("authAdmin.generateLink")).toBeGreaterThan(
      exchange.indexOf('event_name: "return_session_started"'),
    );
  });

  it("keeps the existing 7-Day cookie and carries the platform token in a fragment", () => {
    const route = readSource("../../../routes/return.ts");

    expect(route).toContain("result.platformAuthTokenHash");
    expect(route).toContain("#gxj_auth=");
    expect(route).toContain("encodeURIComponent(result.platformAuthTokenHash)");
    expect(route).toContain("RETURN_SESSION_COOKIE");
    expect(route).toContain("status: 303");
    expect(route).toContain('"referrer-policy": "no-referrer"');
  });

  it("consumes the fragment client-side, strips it from the URL, and establishes Supabase auth", () => {
    const bootstrap = readSource("../../../components/auth-session-bootstrap.tsx");
    const root = readSource("../../../routes/__root.tsx");

    expect(bootstrap).toContain('PLATFORM_AUTH_FRAGMENT_KEY = "gxj_auth"');
    expect(bootstrap).toContain("window.history.replaceState");
    expect(bootstrap).toContain("supabase.auth");
    // Supabase token-hash email verification uses the `email` OTP type even
    // though the admin handoff is generated as a magic link.
    expect(bootstrap).toContain('.verifyOtp({ token_hash: tokenHash, type: "email" })');
    expect(bootstrap).not.toContain('type: "magiclink" })');
    expect(bootstrap.indexOf("window.history.replaceState")).toBeLessThan(
      bootstrap.indexOf(".verifyOtp("),
    );
    expect(root).toContain("<AuthSessionBootstrap />");
  });
});
