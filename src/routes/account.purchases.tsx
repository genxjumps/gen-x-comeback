import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/account/purchases")({
  beforeLoad: () => {
    throw redirect({ to: "/account", hash: "purchases", replace: true });
  },
});
