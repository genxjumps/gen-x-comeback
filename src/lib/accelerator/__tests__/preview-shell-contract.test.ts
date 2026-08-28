import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const route = source("../../../routes/preview.accelerator.tsx");
const preview = source("../../../components/accelerator-program-preview.tsx");
const home = source("../../../routes/index.tsx");

describe("28-Day program preview shell", () => {
  it("keeps the preview out of search results and public navigation", () => {
    expect(route).toContain('name: "robots", content: "noindex, nofollow"');
    expect(home).not.toContain("/preview/accelerator");
  });

  it("uses labeled media placeholders without external video embeds", () => {
    expect(preview).toContain("Cloudflare Stream ID pending");
    expect(preview).toContain("Weekly coaching video placeholder");
    expect(preview).not.toContain("<iframe");
    expect(preview).not.toMatch(/youtube\.com|youtu\.be|cloudflarestream\.com/);
  });

  it("does not invent nutrition targets or workout runtimes", () => {
    expect(preview).toContain("Formula pending");
    expect(preview).toContain("Runtime pending");
  });

  it("uses the confirmed equipment and simple weekly tracking direction", () => {
    expect(preview).toContain("ACCELERATOR_EQUIPMENT.program");
    expect(preview).toContain("No dumbbells, bench, or gym equipment required");
    expect(preview).toContain("Weekly Check-In");
    expect(preview).toContain("Weight");
    expect(preview).toContain("Waist");
  });

  it("has no server writes or live enrollment behavior", () => {
    expect(preview).not.toContain("useServerFn");
    expect(preview).not.toContain("fetch(");
    expect(preview).not.toContain("supabase");
  });
});
