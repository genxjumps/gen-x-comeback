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
  it("shows only the primary verified identity and navigation, without session explanations", () => {
    const html = render({
      ok: true,
      accountEmail: "paid@example.com",
      planEmail: "free@example.com",
    });
    expect(html).toContain("paid@example.com");
    expect(html).toContain("Signed in as");
    expect(html).not.toContain("free@example.com");
    expect(html).not.toContain("Logging out clears both");
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/recover"');
    expect(html).toContain("Get a Magic Access Link");
    expect(html).toContain("Log Out");
    expect(html).not.toContain("unsaved assessment answers");
    expect(html).not.toContain("saved plans stay safe");
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
