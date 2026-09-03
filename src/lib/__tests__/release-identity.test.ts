import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveReleaseSha, summarizeReleaseEnvironment } from "../../../scripts/release-identity";

const routeSource = readFileSync(
  fileURLToPath(new URL("../../routes/api/public/release.ts", import.meta.url)),
  "utf8",
);
const viteSource = readFileSync(
  fileURLToPath(new URL("../../../vite.config.ts", import.meta.url)),
  "utf8",
);
const buildGuardSource = readFileSync(
  fileURLToPath(new URL("../../../scripts/assert-production-env.ts", import.meta.url)),
  "utf8",
);

describe("release identity", () => {
  const gitSha = "a".repeat(40);
  const environmentSha = "b".repeat(40);

  it("uses the checked-out Git commit before builder environment fallbacks", () => {
    expect(resolveReleaseSha({ GITHUB_SHA: environmentSha }, () => gitSha)).toBe(gitSha);
  });

  it("uses a full builder commit SHA when Git metadata is unavailable", () => {
    expect(
      resolveReleaseSha({ GITHUB_SHA: environmentSha }, () => {
        throw new Error("no git metadata");
      }),
    ).toBe(environmentSha);
  });

  it("rejects missing or abbreviated commit identities", () => {
    expect(() => resolveReleaseSha({ GITHUB_SHA: "abc123" }, () => "not-a-sha")).toThrow(
      "full 40-character Git commit SHA",
    );
  });

  it("reports only safe release-metadata variable names and SHA shape", () => {
    expect(
      summarizeReleaseEnvironment({
        GITHUB_SHA: gitSha,
        LOVABLE_COMMIT_SHA: "short",
        GITLAB_TOKEN: environmentSha,
        ORDINARY_SETTING: "present",
        "UNSAFE-NAME-SHA": environmentSha,
      }),
    ).toBe("GITHUB_SHA:full-sha, LOVABLE_COMMIT_SHA:not-full-sha");
    expect(summarizeReleaseEnvironment({ ORDINARY_SETTING: "present" })).toBe("none");
  });

  it("injects the commit into a public no-store release endpoint", () => {
    expect(viteSource).toContain("__GXJ_RELEASE_SHA__: JSON.stringify(releaseSha)");
    expect(routeSource).toContain('createFileRoute("/api/public/release")');
    expect(routeSource).toContain("commit: __GXJ_RELEASE_SHA__");
    expect(routeSource).toContain('"cache-control": "no-store"');
  });

  it("refuses production builds without a verified release SHA", () => {
    expect(buildGuardSource).toContain("releaseSha = resolveReleaseSha()");
    expect(buildGuardSource).toContain("A verified Git release SHA is unavailable");
    expect(buildGuardSource).toContain("Release metadata variable probe (names and shape only)");
  });
});
