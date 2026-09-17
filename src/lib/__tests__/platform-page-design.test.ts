import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const platformPageSource = readFileSync(
  new URL("../../components/platform-page.tsx", import.meta.url),
  "utf8",
);

describe("shared platform page typography", () => {
  it("uses the Precision Utility page hierarchy and 16px introduction as the safe defaults", () => {
    expect(platformPageSource).toContain('titleSize = "compact"');
    expect(platformPageSource).toContain('titleSize?: "compact" | "hero"');
    expect(platformPageSource).toContain(
      '"text-[2.75rem] leading-[0.96] tracking-[-0.03em] sm:text-[3.5rem]"',
    );
    expect(platformPageSource).toContain(
      '"text-[2rem] leading-[1.05] tracking-[-0.025em] sm:text-[2.5rem]"',
    );
    expect(platformPageSource).toContain(
      'className="mt-3 max-w-xl text-base font-normal leading-6 text-[var(--pu-text-secondary)]"',
    );
    expect(platformPageSource).not.toContain("sm:text-lg");
  });
});
