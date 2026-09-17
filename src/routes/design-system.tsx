import { createFileRoute } from "@tanstack/react-router";

import { PrecisionUtilityShowcase } from "@/design-system/precision/showcase";
import "@/design-system/precision/tokens.css";
import "@/design-system/precision/components.css";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [
      { title: "Precision Utility | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PrecisionUtilityShowcase,
});
