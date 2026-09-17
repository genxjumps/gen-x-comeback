import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PWA_NUDGE_DELAY_MS } from "@/lib/pwa-install";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const component = source("../../components/pwa-install.tsx");
const readyRoute = source("../../routes/plan-ready.tsx");
const planRoute = source("../../routes/your-plan.index.tsx");
const rootRoute = source("../../routes/__root.tsx");
const manifest = source("../../../public/manifest.webmanifest");

describe("Home Screen install experience", () => {
  it("provides the exact iPhone Share, Add to Home Screen, and Add sequence", () => {
    expect(component).toContain("Open the Share menu");
    expect(component).toContain("Choose Add to Home Screen");
    expect(component).toContain("Tap Add");
  });

  it("never blocks plan access and waits 24 hours before a dismissed nudge returns", () => {
    expect(component).toContain("Not Now - View My Plan");
    expect(component).toContain("Remind Me Later");
    expect(PWA_NUDGE_DELAY_MS).toBe(24 * 60 * 60 * 1000);
    expect(readyRoute).toContain('navigate({ to: "/your-plan", replace: true })');
    expect(planRoute).toContain("<InstallNudge");
  });

  it("uses plain, concise Home Screen copy on the plan-ready page", () => {
    expect(component).toContain("Add to My Home Screen");
    expect(component).toContain("No app store required.");
    expect(component).not.toContain("Works like an app");
    expect(readyRoute).not.toContain("Your personalized 7-day plan is saved and ready");
  });

  it("uses the approved focused install treatment without changing the compact nudge", () => {
    expect(readyRoute).toContain("gxj-page");
    expect(readyRoute).toContain(
      "gxj-display-title mt-4 text-3xl uppercase leading-none tracking-wide sm:text-4xl",
    );
    expect(component).not.toContain("min-h-20 w-full justify-between");
    expect(component).not.toContain("rounded-full bg-background text-gxj-orange");
    expect(component).toContain(': "mt-7 w-full sm:w-auto"');
    expect(component).toContain("border-y border-[var(--pu-border-subtle)] py-5");
    expect(component).toContain(
      'className={compact ? "mt-5 w-full sm:w-auto" : "mt-7 w-full sm:w-auto"}',
    );
  });

  it("registers the PWA shell and captures native install events", () => {
    expect(rootRoute).toContain("<PwaInstallCapture />");
    expect(component).toContain('navigator.serviceWorker.register("/sw.js")');
    expect(component).toContain('window.addEventListener("beforeinstallprompt"');
    expect(manifest).toContain('"display": "standalone"');
    expect(manifest).toContain('"start_url": "/your-plan"');
  });

  it("uses platform-appropriate installed confirmation copy", () => {
    expect(component).toContain("Gen X Jumps is installed.");
    expect(component).toContain("Gen X Jumps is on your Home Screen.");
  });
});
