import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  createReleaseSourceManifest,
  releaseSourceManifestPath,
  resolveReleaseSourceFingerprint,
  serializeReleaseSourceManifest,
  type ReleaseSourceManifest,
} from "../../../scripts/release-fingerprint";

const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));
const temporaryDirectories: Array<string> = [];

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function createTemporaryReleaseSource(content: string): string {
  const directory = mkdtempSync(join(tmpdir(), "gxj-release-source-"));
  const manifest: ReleaseSourceManifest = {
    version: 1,
    files: [{ path: "source.ts", sha256: sha256(content) }],
  };

  temporaryDirectories.push(directory);
  writeFileSync(join(directory, "source.ts"), content);
  writeFileSync(
    join(directory, releaseSourceManifestPath),
    serializeReleaseSourceManifest(manifest),
  );

  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("release source fingerprint", () => {
  it("matches the committed manifest to the current tracked build inputs", () => {
    const committedManifest = JSON.parse(
      readFileSync(join(projectRoot, releaseSourceManifestPath), "utf8"),
    );

    expect(createReleaseSourceManifest(projectRoot)).toEqual(committedManifest);
    expect(resolveReleaseSourceFingerprint(projectRoot)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("calculates a deterministic fingerprint without Git metadata", () => {
    const directory = createTemporaryReleaseSource("approved source\n");

    expect(resolveReleaseSourceFingerprint(directory)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(resolveReleaseSourceFingerprint(directory)).toBe(
      resolveReleaseSourceFingerprint(directory),
    );
  });

  it("fails closed when a source file differs from its manifest", () => {
    const directory = createTemporaryReleaseSource("approved source\n");

    writeFileSync(join(directory, "source.ts"), "changed source\n");

    expect(() => resolveReleaseSourceFingerprint(directory)).toThrow(
      "Release source verification failed for source.ts",
    );
  });

  it("rejects unsafe manifest paths", () => {
    expect(() =>
      serializeReleaseSourceManifest({
        version: 1,
        files: [{ path: "../secret", sha256: "a".repeat(64) }],
      }),
    ).toThrow("unsafe or duplicate path");
  });
});
