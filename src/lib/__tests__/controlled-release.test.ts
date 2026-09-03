import { describe, expect, it } from "vitest";

import {
  fetchGreenPostMergeQualityGate,
  readRequiredArgument,
  selectGreenPostMergeQualityGate,
  selectGreenRequiredQualityCheck,
  verifyLovableReleaseSha,
  verifyProductionRelease,
  verifyReleaseCheckout,
} from "../../../scripts/controlled-release";

const releaseSha = "a".repeat(40);
const sourceFingerprint = `sha256:${"b".repeat(64)}`;

describe("controlled release verification", () => {
  it("accepts only a clean release checkout matching the remote branch", () => {
    expect(
      verifyReleaseCheckout({
        branch: "release/v1.1",
        headSha: releaseSha,
        remoteReleaseSha: releaseSha,
        status: "",
        sourceFingerprint,
      }),
    ).toMatchObject({ releaseSha, remoteReleaseSha: releaseSha, sourceFingerprint });

    expect(() =>
      verifyReleaseCheckout({
        branch: "agent/work",
        headSha: releaseSha,
        remoteReleaseSha: releaseSha,
        status: "",
        sourceFingerprint,
      }),
    ).toThrow("release/v1.1 branch");

    expect(() =>
      verifyReleaseCheckout({
        branch: "release/v1.1",
        headSha: releaseSha,
        remoteReleaseSha: "c".repeat(40),
        status: "",
        sourceFingerprint,
      }),
    ).toThrow("does not match GitHub");

    expect(() =>
      verifyReleaseCheckout({
        branch: "release/v1.1",
        headSha: releaseSha,
        remoteReleaseSha: releaseSha,
        status: " M changed.ts",
        sourceFingerprint,
      }),
    ).toThrow("clean working tree");
  });

  it("requires Lovable to report the exact approved release SHA", () => {
    expect(verifyLovableReleaseSha(releaseSha, releaseSha.toUpperCase())).toBe(releaseSha);
    expect(() => verifyLovableReleaseSha(releaseSha, "c".repeat(40))).toThrow(
      "does not match the approved GitHub release SHA",
    );
  });

  it("requires a successful post-merge Quality Gate on the exact release", () => {
    const successfulRun = {
      id: 165,
      name: "Quality Gate",
      event: "push",
      head_branch: "release/v1.1",
      head_sha: releaseSha,
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/genxjumps/gen-x-comeback/actions/runs/165",
    };

    expect(selectGreenPostMergeQualityGate([successfulRun], releaseSha)).toEqual({
      id: 165,
      url: successfulRun.html_url,
    });
    expect(() =>
      selectGreenPostMergeQualityGate([{ ...successfulRun, event: "pull_request" }], releaseSha),
    ).toThrow("No successful post-merge Quality Gate");
    expect(() =>
      selectGreenPostMergeQualityGate([{ ...successfulRun, conclusion: "failure" }], releaseSha),
    ).toThrow("No successful post-merge Quality Gate");
  });

  it("requires the exact locked-source job to pass in the selected Quality Gate", () => {
    const successfulJob = {
      id: 129,
      name: "Verify locked source",
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/genxjumps/gen-x-comeback/actions/runs/165/job/129",
    };

    expect(selectGreenRequiredQualityCheck([successfulJob])).toEqual({
      id: 129,
      url: successfulJob.html_url,
    });
    expect(() =>
      selectGreenRequiredQualityCheck([{ ...successfulJob, name: "Other check" }]),
    ).toThrow("Verify locked source job did not pass");
    expect(() =>
      selectGreenRequiredQualityCheck([{ ...successfulJob, conclusion: "failure" }]),
    ).toThrow("Verify locked source job did not pass");
  });

  it("records both the successful post-merge run and locked-source job", async () => {
    const requestedUrls: Array<string> = [];
    const fetcher: typeof fetch = async (input) => {
      const url = input.toString();
      requestedUrls.push(url);

      if (url.includes("/actions/runs?")) {
        return Response.json({
          workflow_runs: [
            {
              id: 165,
              name: "Quality Gate",
              event: "push",
              head_branch: "release/v1.1",
              head_sha: releaseSha,
              status: "completed",
              conclusion: "success",
              html_url: "https://github.com/genxjumps/gen-x-comeback/actions/runs/165",
            },
          ],
        });
      }

      return Response.json({
        jobs: [
          {
            id: 129,
            name: "Verify locked source",
            status: "completed",
            conclusion: "success",
            html_url: "https://github.com/genxjumps/gen-x-comeback/actions/runs/165/job/129",
          },
        ],
      });
    };

    await expect(fetchGreenPostMergeQualityGate(releaseSha, fetcher)).resolves.toEqual({
      runId: 165,
      runUrl: "https://github.com/genxjumps/gen-x-comeback/actions/runs/165",
      jobId: 129,
      jobUrl: "https://github.com/genxjumps/gen-x-comeback/actions/runs/165/job/129",
    });
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toContain(`head_sha=${releaseSha}`);
    expect(requestedUrls[1]).toContain("/actions/runs/165/jobs");
  });

  it("proves production with the exact source fingerprint and no-store response", () => {
    expect(
      verifyProductionRelease({
        cacheControl: "private, no-store",
        expected: { commit: releaseSha, sourceFingerprint },
        payload: {
          application: "gen-x-comeback",
          commit: releaseSha,
          sourceFingerprint,
        },
      }),
    ).toEqual({
      application: "gen-x-comeback",
      commit: releaseSha,
      identityProof: "commit-and-source-fingerprint",
      sourceFingerprint,
    });
  });

  it("accepts a null builder commit only when the exact fingerprint proves the source", () => {
    expect(
      verifyProductionRelease({
        cacheControl: "no-store",
        expected: { commit: releaseSha, sourceFingerprint },
        payload: {
          application: "gen-x-comeback",
          commit: null,
          sourceFingerprint,
        },
      }).identityProof,
    ).toBe("source-fingerprint");
  });

  it("fails closed for stale, cached, or malformed production identity", () => {
    expect(() =>
      verifyProductionRelease({
        cacheControl: "max-age=60",
        expected: { commit: releaseSha, sourceFingerprint },
        payload: {
          application: "gen-x-comeback",
          commit: releaseSha,
          sourceFingerprint,
        },
      }),
    ).toThrow("cache-control: no-store");

    expect(() =>
      verifyProductionRelease({
        cacheControl: "no-store",
        expected: { commit: releaseSha, sourceFingerprint },
        payload: {
          application: "gen-x-comeback",
          commit: releaseSha,
          sourceFingerprint: `sha256:${"c".repeat(64)}`,
        },
      }),
    ).toThrow("does not match the approved release source fingerprint");

    expect(() =>
      verifyProductionRelease({
        cacheControl: "no-store",
        expected: { commit: releaseSha, sourceFingerprint },
        payload: {
          application: "gen-x-comeback",
          commit: "c".repeat(40),
          sourceFingerprint,
        },
      }),
    ).toThrow("different Git commit");
  });

  it("requires explicit release evidence arguments", () => {
    expect(readRequiredArgument("--lovable-sha", [`--lovable-sha=${releaseSha}`])).toBe(releaseSha);
    expect(readRequiredArgument("--deployment-id", ["--deployment-id", "deployment-1"])).toBe(
      "deployment-1",
    );
    expect(() => readRequiredArgument("--deployment-id", [])).toThrow(
      "Missing required argument --deployment-id",
    );
  });
});
