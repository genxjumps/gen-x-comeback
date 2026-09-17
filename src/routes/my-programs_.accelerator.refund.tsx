import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/my-programs_/accelerator/refund")({
  beforeLoad: () => {
    throw redirect({ to: "/account", hash: "purchases", replace: true });
  },
});
