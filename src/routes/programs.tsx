import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/programs")({
  beforeLoad: () => {
    throw redirect({ to: "/my-programs", hash: "available", replace: true });
  },
});
