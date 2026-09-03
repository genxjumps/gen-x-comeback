import {
  fetchGreenPostMergeQualityGate,
  productionReleaseEndpoint,
  readRequiredArgument,
  readVerifiedReleaseCheckout,
  verifyLovableReleaseSha,
} from "./controlled-release";

async function main(): Promise<void> {
  const lovableLatestCommitSha = readRequiredArgument("--lovable-sha", process.argv.slice(2));
  const release = readVerifiedReleaseCheckout();
  const lovableSha = verifyLovableReleaseSha(release.releaseSha, lovableLatestCommitSha);
  const qualityGate = await fetchGreenPostMergeQualityGate(release.releaseSha);

  console.log(
    JSON.stringify(
      {
        status: "ready-to-publish",
        releaseSha: release.releaseSha,
        sourceFingerprint: release.sourceFingerprint,
        lovableLatestCommitSha: lovableSha,
        qualityGate,
        productionReleaseEndpoint,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(
    `[release] Preflight failed: ${error instanceof Error ? error.message : "Unknown error."}`,
  );
  process.exit(1);
});
