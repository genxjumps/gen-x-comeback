import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../../start.ts", import.meta.url)),
  "utf8",
);

describe("server-function CSRF public-origin contract", () => {
  it("keeps server-function CSRF filtering enabled", () => {
    expect(source).toContain('filter: (ctx) => ctx.handlerType === "serverFn"');
  });

  it("accepts the request origin or the configured public APP_ORIGIN", () => {
    expect(source).toContain("origin === new URL(ctx.request.url).origin");
    expect(source).toContain('process.env["APP_ORIGIN"]');
    expect(source).toContain("origin === new URL(appOrigin).origin");
  });

  it("does not disable origin verification", () => {
    expect(source).not.toContain("allowRequestsWithoutOriginCheck: true");
  });
});
