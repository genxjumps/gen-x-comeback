import { describe, expect, it } from "vitest";

import { getReviewScreen, reviewScreens } from "@/lib/app-review";

describe("app review catalog", () => {
  it("uses one stable URL for every review state", () => {
    const slugs = reviewScreens.map((screen) => screen.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(getReviewScreen(slug)?.slug).toBe(slug);
  });

  it("covers every customer-facing screen family", () => {
    const routes = new Set(reviewScreens.map((screen) => screen.route));
    expect(routes.size).toBeGreaterThan(0);
    for (const route of [
      "/",
      "/assessment/start",
      "/assessment",
      "/assessment/complete",
      "/welcome",
      "/plan-ready",
      "/home",
      "/your-plan",
      "/your-plan/day/1",
      "/jump-ropes",
      "/my-programs",
      "/programs/accelerator",
      "/checkout/accelerator/success",
      "/my-programs/accelerator/setup",
      "/accelerator",
      "/my-programs/accelerator/runs",
      "/progress",
      "/nutrition",
      "/notifications",
      "/account",
      "/account/purchases",
      "/my-programs/accelerator/refund",
      "/recover",
    ]) {
      expect(routes.has(route)).toBe(true);
    }
  });

  it("keeps all review screens off live account data", () => {
    for (const screen of reviewScreens) {
      expect(screen.slug).not.toContain("@");
      expect(screen.slug).not.toContain("?");
      expect(screen.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
