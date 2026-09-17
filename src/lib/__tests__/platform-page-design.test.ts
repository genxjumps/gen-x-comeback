import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const platformPageSource = readFileSync(
  new URL("../../components/platform-page.tsx", import.meta.url),
  "utf8",
);
const appPrimitivesSource = readFileSync(
  new URL("../../components/app-primitives.tsx", import.meta.url),
  "utf8",
);

describe("shared platform page typography", () => {
  it("uses the compact app title and 16px introduction as the safe defaults", () => {
    expect(platformPageSource).toContain('titleSize = "compact"');
    expect(platformPageSource).toContain('titleSize?: "compact" | "hero"');
    expect(platformPageSource).toContain(
      'titleSize === "hero" ? "text-5xl sm:text-7xl" : "text-3xl sm:text-4xl"',
    );
    expect(platformPageSource).toContain('<AppBody className="mt-3 max-w-lg">');
    expect(appPrimitivesSource).toContain(
      'text-base font-medium leading-relaxed text-foreground/80',
    );
    expect(platformPageSource).not.toContain("sm:text-lg");
  });
});
