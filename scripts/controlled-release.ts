import { execFileSync } from "node:child_process";

import { resolveReleaseSourceFingerprint } from "./release-fingerprint";
import { resolveReleaseSha, type ReleaseIdentity } from "./release-identity";

export const releaseBranch = "release/v1.1";
export const releaseRepository = "genxjumps/gen-x-comeback";
export const productionReleaseEndpoint = "https://app.genxjumps.com/api/public/release";
export const requiredQualityWorkflow = "Quality Gate";
export const requiredQualityCheck = "Verify locked source";

const fullGitSha = /^[0-9a-f]{40}$/i;
const sourceFingerprint = /^sha256:[0-9a-f]{64}$/;

export type ReleaseCheckout = ReleaseIdentity & {
  branch: string;
  releaseSha: string;
  remoteReleaseSha: string;
};

export type QualityGateRun = {
  conclusion?: unknown;
  event?: unknown;
  head_branch?: unknown;
  head_sha?: unknown;
  html_url?: unknown;
  id?: unknown;
  name?: unknown;
  status?: unknown;
};

export type GreenQualityGate = {
  jobId: number;
  jobUrl: string;
  runId: number;
  runUrl: string;
};

export type QualityGateJob = {
  conclusion?: unknown;
  html_url?: unknown;
  id?: unknown;
  name?: unknown;
  status?: unknown;
};

export type ProductionReleaseProof = {
  application: "gen-x-comeback";
  commit: string | null;
  identityProof: "commit-and-source-fingerprint" | "source-fingerprint";
  sourceFingerprint: string;
};

function runGit(arguments_: Array<string>, rootDirectory: string): string {
  return execFileSync("git", arguments_, {
    cwd: rootDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function normalizeFullGitSha(label: string, value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!fullGitSha.test(normalized)) {
    throw new Error(`${label} must be a full 40-character Git commit SHA.`);
  }

  return normalized;
}

export function verifyReleaseCheckout(input: {
  branch: string;
  headSha: string;
  remoteReleaseSha: string;
  status: string;
  sourceFingerprint: string;
}): ReleaseCheckout {
  const releaseSha = normalizeFullGitSha("Checked-out release", input.headSha);
  const remoteReleaseSha = normalizeFullGitSha("Remote release", input.remoteReleaseSha);

  if (input.branch !== releaseBranch) {
    throw new Error(`Controlled releases must run from the ${releaseBranch} branch.`);
  }

  if (input.status.trim()) {
    throw new Error("Controlled releases require a clean working tree.");
  }

  if (releaseSha !== remoteReleaseSha) {
    throw new Error("The checked-out release SHA does not match GitHub release/v1.1.");
  }

  if (!sourceFingerprint.test(input.sourceFingerprint)) {
    throw new Error("The release source fingerprint is invalid.");
  }

  return {
    branch: input.branch,
    commit: releaseSha,
    releaseSha,
    remoteReleaseSha,
    sourceFingerprint: input.sourceFingerprint,
  };
}

export function readVerifiedReleaseCheckout(
  rootDirectory: string = process.cwd(),
): ReleaseCheckout {
  const remoteRef = `refs/heads/${releaseBranch}`;
  const remoteLine = runGit(["ls-remote", "--heads", "origin", remoteRef], rootDirectory);
  const [remoteReleaseSha, returnedRef] = remoteLine.split(/\s+/, 2);

  if (!remoteReleaseSha || returnedRef !== remoteRef) {
    throw new Error(`Could not resolve GitHub ${releaseBranch}.`);
  }

  return verifyReleaseCheckout({
    branch: runGit(["branch", "--show-current"], rootDirectory),
    headSha: resolveReleaseSha(process.env, () => runGit(["rev-parse", "HEAD"], rootDirectory)),
    remoteReleaseSha,
    status: runGit(["status", "--porcelain"], rootDirectory),
    sourceFingerprint: resolveReleaseSourceFingerprint(rootDirectory),
  });
}

export function verifyLovableReleaseSha(
  expectedReleaseSha: string,
  lovableLatestCommitSha: string,
): string {
  const expected = normalizeFullGitSha("Expected release", expectedReleaseSha);
  const lovable = normalizeFullGitSha("Lovable latest commit", lovableLatestCommitSha);

  if (expected !== lovable) {
    throw new Error("Lovable's latest commit does not match the approved GitHub release SHA.");
  }

  return lovable;
}

export function selectGreenPostMergeQualityGate(
  workflowRuns: Array<QualityGateRun>,
  expectedReleaseSha: string,
): { id: number; url: string } {
  const expected = normalizeFullGitSha("Expected release", expectedReleaseSha);
  const matchingRun = workflowRuns.find(
    (run) =>
      run.name === requiredQualityWorkflow &&
      run.event === "push" &&
      run.head_branch === releaseBranch &&
      typeof run.head_sha === "string" &&
      run.head_sha.toLowerCase() === expected &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      typeof run.id === "number" &&
      typeof run.html_url === "string",
  );

  if (!matchingRun) {
    throw new Error("No successful post-merge Quality Gate exists for the release SHA.");
  }

  return {
    id: matchingRun.id as number,
    url: matchingRun.html_url as string,
  };
}

export async function fetchGreenPostMergeQualityGate(
  expectedReleaseSha: string,
  fetcher: typeof fetch = fetch,
): Promise<GreenQualityGate> {
  const expected = normalizeFullGitSha("Expected release", expectedReleaseSha);
  const url = new URL(`https://api.github.com/repos/${releaseRepository}/actions/runs`);
  url.searchParams.set("branch", releaseBranch);
  url.searchParams.set("event", "push");
  url.searchParams.set("head_sha", expected);
  url.searchParams.set("status", "success");
  url.searchParams.set("per_page", "100");

  const response = await fetcher(url, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Quality Gate lookup failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as { workflow_runs?: unknown };

  if (!Array.isArray(payload.workflow_runs)) {
    throw new Error("GitHub returned an invalid Quality Gate response.");
  }

  const qualityGateRun = selectGreenPostMergeQualityGate(
    payload.workflow_runs as Array<QualityGateRun>,
    expected,
  );

  const jobsResponse = await fetcher(
    `https://api.github.com/repos/${releaseRepository}/actions/runs/${qualityGateRun.id}/jobs?filter=latest&per_page=100`,
    {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    },
  );

  if (!jobsResponse.ok) {
    throw new Error(`GitHub Quality Gate job lookup failed with HTTP ${jobsResponse.status}.`);
  }

  const jobsPayload = (await jobsResponse.json()) as { jobs?: unknown };

  if (!Array.isArray(jobsPayload.jobs)) {
    throw new Error("GitHub returned an invalid Quality Gate jobs response.");
  }

  const qualityGateJob = selectGreenRequiredQualityCheck(jobsPayload.jobs as Array<QualityGateJob>);

  return {
    jobId: qualityGateJob.id,
    jobUrl: qualityGateJob.url,
    runId: qualityGateRun.id,
    runUrl: qualityGateRun.url,
  };
}

export function selectGreenRequiredQualityCheck(jobs: Array<QualityGateJob>): {
  id: number;
  url: string;
} {
  const matchingJob = jobs.find(
    (job) =>
      job.name === requiredQualityCheck &&
      job.status === "completed" &&
      job.conclusion === "success" &&
      typeof job.id === "number" &&
      typeof job.html_url === "string",
  );

  if (!matchingJob) {
    throw new Error(`The ${requiredQualityCheck} job did not pass on the release SHA.`);
  }

  return {
    id: matchingJob.id as number,
    url: matchingJob.html_url as string,
  };
}

export function verifyProductionRelease(input: {
  cacheControl: string | null;
  expected: ReleaseIdentity;
  payload: unknown;
}): ProductionReleaseProof {
  if (
    !input.cacheControl
      ?.toLowerCase()
      .split(",")
      .some((value) => value.trim() === "no-store")
  ) {
    throw new Error("The production release endpoint is not marked cache-control: no-store.");
  }

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    throw new Error("The production release endpoint returned an invalid payload.");
  }

  const payload = input.payload as Record<string, unknown>;

  if (payload.application !== "gen-x-comeback") {
    throw new Error("The production release endpoint returned the wrong application identity.");
  }

  if (payload.sourceFingerprint !== input.expected.sourceFingerprint) {
    throw new Error("Production does not match the approved release source fingerprint.");
  }

  if (
    typeof payload.sourceFingerprint !== "string" ||
    !sourceFingerprint.test(payload.sourceFingerprint)
  ) {
    throw new Error("The production source fingerprint is invalid.");
  }

  if (payload.commit !== null && typeof payload.commit !== "string") {
    throw new Error("The production release commit is invalid.");
  }

  const expectedCommit = input.expected.commit
    ? normalizeFullGitSha("Expected release", input.expected.commit)
    : null;
  const productionCommit =
    typeof payload.commit === "string"
      ? normalizeFullGitSha("Production release", payload.commit)
      : null;

  if (productionCommit && expectedCommit && productionCommit !== expectedCommit) {
    throw new Error("Production reports a different Git commit than the approved release.");
  }

  return {
    application: "gen-x-comeback",
    commit: productionCommit,
    identityProof: productionCommit ? "commit-and-source-fingerprint" : "source-fingerprint",
    sourceFingerprint: payload.sourceFingerprint,
  };
}

export function readRequiredArgument(name: string, arguments_: Array<string>): string {
  const exactIndex = arguments_.indexOf(name);

  if (exactIndex >= 0) {
    const value = arguments_[exactIndex + 1]?.trim();
    if (value && !value.startsWith("--")) return value;
  }

  const prefix = `${name}=`;
  const inline = arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);

  if (!inline?.trim()) {
    throw new Error(`Missing required argument ${name}.`);
  }

  return inline.trim();
}
