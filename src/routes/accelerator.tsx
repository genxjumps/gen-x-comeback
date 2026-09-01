import { createFileRoute } from "@tanstack/react-router";

import { AcceleratorProgram } from "@/components/accelerator-program";
import { AcceleratorVideoTracker } from "@/components/accelerator-video-tracker";

export const Route = createFileRoute("/accelerator")({
  head: () => ({
    meta: [
      { title: "My 28-Day Fat Loss Accelerator | Gen X Jumps" },
      { name: "description", content: "Private 28-Day Fat Loss Accelerator program access." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AcceleratorPage,
});

function AcceleratorPage() {
  return (
    <>
      <AcceleratorVideoTracker />
      <AcceleratorProgram />
    </>
  );
}
