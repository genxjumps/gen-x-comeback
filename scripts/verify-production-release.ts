import {
  fetchGreenPostMergeQualityGate,
  productionReleaseEndpoint,
  readRequiredArgument,
  readVerifiedReleaseCheckout,
  verifyLovableReleaseSha,
  verifyProductionRelease,
} from "./controlled-release";

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  const deploymentId = readRequiredArgument("--deployment-id", arguments_);
  const lovableLatestCommitSha = readRequiredArgument("--lovable-sha", arguments_);
  const release = readVerifiedReleaseCheckout();
  const lovableSha = verifyLovableReleaseSha(release.releaseSha, lovableLatestCommitSha);
  const qualityGate = await fetchGreenPostMergeQualityGate(release.releaseSha);
  const response = await fetch(productionReleaseEndpoint, {
    headers: {
      accept: "application/json",
      "cache-control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Production release lookup failed with HTTP ${response.status}.`);
  }

  const production = verifyProductionRelease({
    cacheControl: response.headers.get("cache-control"),
    expected: release,
    payload: await response.json(),
  });

  console.log(
    JSON.stringify(
      {
        status: "production-verified",
        verifiedAt: new Date().toISOString(),
        deploymentId,
        releaseSha: release.releaseSha,
        sourceFingerprint: release.sourceFingerprint,
        lovableLatestCommitSha: lovableSha,
        qualityGate,
        production,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(
    `[release] Production verification failed: ${error instanceof Error ? error.message : "Unknown error."}`,
  );
  process.exit(1);
});
