import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const releaseSourceManifestPath = "release-source-manifest.json";

const releaseSourceInputs = [
  ".env",
  ".env.example",
  "bun.lock",
  "bunfig.toml",
  "components.json",
  "eslint.config.js",
  "package.json",
  "public",
  "scripts",
  "src",
  "supabase",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
] as const;
const fullSha256 = /^[0-9a-f]{64}$/;
const safeRelativePath = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[^\0]+$/;

export type ReleaseSourceManifest = {
  version: 1;
  files: Array<{
    path: string;
    sha256: string;
  }>;
};

function sha256(content: Uint8Array | string): string {
  return createHash("sha256").update(content).digest("hex");
}

function readTrackedReleaseSourcePaths(rootDirectory: string): Array<string> | null {
  try {
    const insideWorkTree = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: rootDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (insideWorkTree !== "true") return null;
  } catch {
    return null;
  }

  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", ...releaseSourceInputs],
    {
      cwd: rootDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  )
    .split("\n")
    .filter(Boolean)
    .sort();
}

function validateManifest(manifest: ReleaseSourceManifest): void {
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("The release source manifest is missing or invalid.");
  }

  const paths = manifest.files.map((file) => file.path);
  const sortedPaths = [...paths].sort();

  if (new Set(paths).size !== paths.length || paths.some((path) => !safeRelativePath.test(path))) {
    throw new Error("The release source manifest contains an unsafe or duplicate path.");
  }

  if (paths.some((path, index) => path !== sortedPaths[index])) {
    throw new Error("The release source manifest must be sorted by path.");
  }

  if (manifest.files.some((file) => !fullSha256.test(file.sha256))) {
    throw new Error("The release source manifest contains an invalid file digest.");
  }
}

export function createReleaseSourceManifest(
  rootDirectory: string = process.cwd(),
): ReleaseSourceManifest {
  const paths = readTrackedReleaseSourcePaths(rootDirectory);

  if (!paths) {
    throw new Error("Git metadata is required to create the release source manifest.");
  }

  return {
    version: 1,
    files: paths.map((path) => ({
      path,
      sha256: sha256(readFileSync(resolve(rootDirectory, path))),
    })),
  };
}

export function serializeReleaseSourceManifest(manifest: ReleaseSourceManifest): string {
  validateManifest(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function resolveReleaseSourceFingerprint(rootDirectory: string = process.cwd()): string {
  const manifest = JSON.parse(
    readFileSync(resolve(rootDirectory, releaseSourceManifestPath), "utf8"),
  ) as ReleaseSourceManifest;

  validateManifest(manifest);

  const trackedPaths = readTrackedReleaseSourcePaths(rootDirectory);
  const manifestPaths = manifest.files.map((file) => file.path);

  if (trackedPaths && JSON.stringify(trackedPaths) !== JSON.stringify(manifestPaths)) {
    throw new Error("The release source manifest does not match the tracked build inputs.");
  }

  const fingerprint = createHash("sha256");

  for (const file of manifest.files) {
    const actualDigest = sha256(readFileSync(resolve(rootDirectory, file.path)));

    if (actualDigest !== file.sha256) {
      throw new Error(`Release source verification failed for ${file.path}.`);
    }

    fingerprint.update(file.path);
    fingerprint.update("\0");
    fingerprint.update(file.sha256);
    fingerprint.update("\n");
  }

  return `sha256:${fingerprint.digest("hex")}`;
}
