import { createFileRoute } from "@tanstack/react-router";

import { ReviewHub } from "@/routes/review";

export const Route = createFileRoute("/review/")({
  head: () => ({
    meta: [
      { title: "App Review | Gen X Jumps" },
      { name: "description", content: "Private working index of Gen X Jumps app screens." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewHub,
});
