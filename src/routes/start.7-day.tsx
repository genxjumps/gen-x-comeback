import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { IntakeClosed } from "@/components/intake-closed";
import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";
import { beginVisualReview, isVisualReviewHost } from "@/lib/visual-review";

export const Route = createFileRoute("/start/7-day")({
  head: () => ({
    meta: [
      { title: "Start Your Free 7-Day Plan | Gen X Jumps" },
      {
        name: "description",
        content: "Start your personalized Gen X Jumps 7-Day Comeback Plan on the website.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SevenDayStart,
});

function SevenDayStart() {
  const navigate = useNavigate();
  const [visualReviewHost, setVisualReviewHost] = useState(false);

  useEffect(() => {
    const preview = isVisualReviewHost();
    setVisualReviewHost(preview);
    if (preview) {
      beginVisualReview();
      navigate({ to: "/welcome", replace: true });
      return;
    }
    if (NEW_PLAN_INTAKE_OPEN) {
      window.location.replace("https://genxjumps.com/start-here/");
    }
  }, [navigate]);

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-10 sm:py-16">
      {visualReviewHost || NEW_PLAN_INTAKE_OPEN ? (
        <p className="text-sm text-muted-foreground" role="status">
          Opening the new-user flow...
        </p>
      ) : (
        <IntakeClosed />
      )}
    </div>
  );
}
