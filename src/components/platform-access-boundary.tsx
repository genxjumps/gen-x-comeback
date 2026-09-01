import { useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

export function PlatformAccessBoundary({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setStatus(data.session ? "allowed" : "denied");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setStatus(session ? "allowed" : "denied");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
        <p className="text-sm text-muted-foreground">Loading your Gen X Jumps account...</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 sm:p-8">
          <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
            Private Access
          </p>
          <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight">
            Open Your Secure Access Link
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We couldn&rsquo;t confirm a signed-in Gen X Jumps account in this browser. Public
            enrollment is still closed during development.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
