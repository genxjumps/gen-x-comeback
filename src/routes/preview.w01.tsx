import { createFileRoute, redirect } from "@tanstack/react-router";

// Temporary compatibility route: the W01 playback proof now lives at /your-plan/day/1.
export const Route = createFileRoute("/preview/w01")({
  beforeLoad: () => {
    throw redirect({ to: "/your-plan/day/1", replace: true });
  },
});
