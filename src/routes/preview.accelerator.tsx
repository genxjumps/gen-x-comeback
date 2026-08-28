import { createFileRoute } from "@tanstack/react-router";

import { AcceleratorProgramPreview } from "@/components/accelerator-program-preview";

export const Route = createFileRoute("/preview/accelerator")({
  head: () => ({
    meta: [
      { title: "28-Day Program Preview | Gen X Jumps" },
      {
        name: "description",
        content: "Internal layout preview for the 28-Day Fat Loss Accelerator program experience.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AcceleratorProgramPreview,
});
