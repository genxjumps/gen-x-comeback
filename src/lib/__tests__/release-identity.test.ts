import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveReleaseIdentity, resolveReleaseSha } from "../../../scripts/release-identity";

const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));
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

  it("retains a verified source fingerprint when builder commit metadata is unavailable", () => {
    const identity = resolveReleaseIdentity(
      {},
      () => {
        throw new Error("no git metadata");
      },
      projectRoot,
    );

    expect(identity.commit).toBeNull();
    expect(identity.sourceFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("injects the identity into a public no-store release endpoint", () => {
    expect(viteSource).toContain("__GXJ_RELEASE_SHA__: JSON.stringify(releaseIdentity.commit)");
    expect(viteSource).toContain("__GXJ_RELEASE_SOURCE_FINGERPRINT__");
    expect(routeSource).toContain('createFileRoute("/api/public/release")');
    expect(routeSource).toContain("commit: __GXJ_RELEASE_SHA__");
    expect(routeSource).toContain("sourceFingerprint: __GXJ_RELEASE_SOURCE_FINGERPRINT__");
    expect(routeSource).toContain('"cache-control": "no-store"');
  });

  it("refuses production builds when source verification fails", () => {
    expect(buildGuardSource).toContain("releaseIdentity = resolveReleaseIdentity()");
    expect(buildGuardSource).toContain("Release source verification failed");
    expect(buildGuardSource).toContain("Release source fingerprint");
  });
});
