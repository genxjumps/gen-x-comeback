import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const middlewareSource = readFileSync(
  fileURLToPath(new URL("../safe-supabase-auth-attacher.ts", import.meta.url)),
  "utf8",
);
const startSource = readFileSync(fileURLToPath(new URL("../../start.ts", import.meta.url)), "utf8");

describe("fail-soft browser auth middleware contract", () => {
  it("is the global server-function middleware", () => {
    expect(startSource).toContain('import { attachSupabaseAuthSafely } from "@/lib/safe-supabase-auth-attacher"');
    expect(startSource).toContain("functionMiddleware: [attachSupabaseAuthSafely]");
  });

  it("attempts to attach a member bearer token when Supabase auth is available", () => {
    expect(middlewareSource).toContain("await supabase.auth.getSession()");
    expect(middlewareSource).toContain("Authorization: `Bearer ${token}`");
  });

  it("continues to next when browser Supabase auth throws", () => {
    expect(middlewareSource).toContain("catch (error)");
    expect(middlewareSource).toContain("return next({");
    expect(middlewareSource).toContain("headers: token ? { Authorization: `Bearer ${token}` } : {}");
  });
});
