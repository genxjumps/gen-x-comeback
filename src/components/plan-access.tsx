import { Link } from "@tanstack/react-router";

import { AppStatePanel } from "@/components/precision-surfaces";
import { Button } from "@/components/ui/button";

/** Controlled return path shown when access is missing or invalid. */
export function AccessDenied() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <AppStatePanel
        state="locked"
        title="This Plan Is Private"
        description="We could not confirm access from this browser. Open your saved results or build your plan to unlock it."
        action={
          <div className="grid gap-3 sm:flex">
            <Button asChild className="w-full sm:w-auto">
              <Link to="/assessment/complete">Go to My Results</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/assessment/start">Create My 7-Day Plan</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
