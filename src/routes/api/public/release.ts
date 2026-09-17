import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/release")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            application: "gen-x-comeback",
            commit: __GXJ_RELEASE_SHA__,
            sourceFingerprint: __GXJ_RELEASE_SOURCE_FINGERPRINT__,
          },
          {
            headers: {
              "cache-control": "no-store",
            },
          },
        ),
    },
  },
});
