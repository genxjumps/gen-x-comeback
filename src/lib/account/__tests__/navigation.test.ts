import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AccountIdentityResult } from "../functions";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/account/functions", () => ({ getAccountIdentity: vi.fn() }));
import { AccountNavigationContent } from "@/components/account-navigation";

function render(identity: AccountIdentityResult | null, error = false, busy = false) {
  return renderToStaticMarkup(
    createElement(AccountNavigationContent, {
      identity,
      error,
      busy,
      onLogOut: () => undefined,
    }),
  );
}

describe("account navigation identity and logout states", () => {
  it("identifies both verified identities when this browser has different free and platform accounts", () => {
    const html = render({
      ok: true,
      accountEmail: "paid@example.com",
      planEmail: "free@example.com",
    });
    expect(html).toContain("paid@example.com");
    expect(html).toContain("free@example.com");
    expect(html).toContain("Logging out clears both");
    expect(html).toContain('href="/account"');
    expect(html).toContain("unsaved assessment answers");
  });

  it("supports verified free-plan-only access", () => {
    const html = render({ ok: true, accountEmail: null, planEmail: "free@example.com" });
    expect(html).toContain("free@example.com");
    expect(html).toContain("Log Out");
    expect(html).not.toContain("also has");
  });

  it("keeps account access available while loading and logout available when identity lookup fails", () => {
    const loading = render(null);
    expect(loading).toContain('href="/account"');
    expect(loading).not.toContain("<button");
    const failed = render({ ok: false });
    expect(failed).toContain("couldn’t load your account");
    expect(failed).toContain("Log Out");
    expect(failed).not.toContain("Signed in as");
  });

  it("hides stale identity and preserves retry after partial logout, even if identity reloads", () => {
    const identity = { ok: true as const, accountEmail: "old@example.com", planEmail: null };
    const failed = render(identity, true);
    expect(failed).toContain("Try Logging Out Again");
    expect(failed).not.toContain("old@example.com");
    const pending = render(identity, false, true);
    expect(pending).toContain('disabled=""');
    expect(pending).not.toContain("old@example.com");
  });
});
