import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("authenticated platform shell source contract", () => {
  it("keeps Daily Assignment first on Home and links every approved platform section", () => {
    const home = readSource("../../../routes/home.tsx");
    const shell = readSource("../../../components/platform-shell.tsx");
    const renderedHome = home.slice(home.indexOf("function PlatformHome"));

    expect(renderedHome.indexOf("Daily Assignment")).toBeLessThan(
      renderedHome.indexOf('aria-label="Your fitness platform"'),
    );
    expect(home).toContain('to: "/my-programs"');
    expect(home).toContain('to: "/progress"');
    expect(home).toContain('to: "/nutrition"');
    expect(home).toContain('to: "/programs"');
    expect(shell).toContain('to="/notifications"');
  });

  it("uses one responsive navigation shell for the private platform routes", () => {
    const root = readSource("../../../routes/__root.tsx");
    const shell = readSource("../../../components/platform-shell.tsx");
    const access = readSource("../../../components/platform-access-boundary.tsx");

    for (const route of [
      "/home",
      "/my-programs",
      "/progress",
      "/nutrition",
      "/programs",
      "/notifications",
      "/accelerator",
    ]) {
      expect(root).toContain(`pathname === "${route}"`);
    }
    expect(root).toContain("<PlatformShell>");
    expect(root).toContain("<PlatformAccessBoundary>");
    expect(shell).toContain('aria-label="Main navigation"');
    expect(shell).toContain("safe-area-inset-bottom");
    expect(access).toContain("supabase.auth.getSession()");
    expect(access).toContain("supabase.auth.onAuthStateChange");
    expect(access).toContain("enrollment is still closed during development");
  });

  it("keeps unfinished provider behavior inactive and visible as placeholders", () => {
    const home = readSource("../../../routes/home.tsx");
    const nutrition = readSource("../../../routes/nutrition.tsx");
    const programs = readSource("../../../routes/programs.tsx");
    const notifications = readSource("../../../routes/notifications.tsx");

    expect(home).toContain("Assignment video placeholder");
    expect(home).toContain("programs.activeProgram");
    expect(home).toContain('to: "/accelerator"');
    expect(home).toContain('to: "/your-plan"');
    expect(nutrition).toContain("No unapproved target formula is active");
    expect(programs).toContain("without opening checkout");
    expect(notifications).toContain("No notifications have been activated");
  });
});
