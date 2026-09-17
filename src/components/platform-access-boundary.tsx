import { useEffect, useState, type ReactNode } from "react";

import { AppLoading, AppState } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const PLATFORM_AUTH_FRAGMENT_KEY = "gxj_auth";

function platformAuthTokenHash(): string | null {
  if (typeof window === "undefined") return null;
  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(fragment).get(PLATFORM_AUTH_FRAGMENT_KEY);
}

export function PlatformAccessBoundary({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let active = true;

    async function confirmSession() {
      const tokenHash = platformAuthTokenHash();
      if (tokenHash) {
        // The recovery-link handoff lands on a private route with its one-time
        // token in the fragment. Redeem it before checking the browser session
        // so this boundary cannot deny access during that brief race.
        const cleanUrl = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(window.history.state, "", cleanUrl);
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
        if (error) {
          console.error("[Auth] Could not establish the Gen X Jumps member session.", error);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (active) setStatus(data.session ? "allowed" : "denied");
    }

    void confirmSession();

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
      <div className="mx-auto w-full max-w-xl px-5 py-16">
        <AppLoading />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-16">
        <AppState
          state="locked"
          title="Open Your Secure Access Link"
          description="We couldn’t confirm a signed-in Gen X Jumps account in this browser."
          action={
            <div className="grid gap-3 sm:flex">
              <Button asChild>
                <a href="/recover">Get a Magic Access Link</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/account">Account and Log Out</a>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return children;
}
