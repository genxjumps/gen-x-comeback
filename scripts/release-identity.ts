import { execFileSync } from "node:child_process";

const fullGitSha = /^[0-9a-f]{40}$/i;
const releaseEnvironmentNames = [
  "GITHUB_SHA",
  "LOVABLE_GIT_COMMIT_SHA",
  "COMMIT_SHA",
  "SOURCE_VERSION",
] as const;

type ReleaseEnvironment = Readonly<Record<string, string | undefined>>;
type GitHeadReader = () => string;

function readGitHead(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

export function resolveReleaseSha(
  environment: ReleaseEnvironment = process.env,
  gitHeadReader: GitHeadReader = readGitHead,
): string {
  try {
    const gitHead = gitHeadReader().trim();
    if (fullGitSha.test(gitHead)) return gitHead.toLowerCase();
  } catch {
    // Some external builders omit .git metadata. Their explicit commit
    // environment variable is the only accepted fallback.
  }

  for (const name of releaseEnvironmentNames) {
    const candidate = environment[name]?.trim();
    if (candidate && fullGitSha.test(candidate)) return candidate.toLowerCase();
  }

  throw new Error("A full 40-character Git commit SHA is required for a production build.");
}
