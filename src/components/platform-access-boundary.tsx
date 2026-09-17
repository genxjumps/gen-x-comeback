import { useEffect, useState, type ReactNode } from "react";

import { AppPanel, AppSupportingText } from "@/components/app-primitives";
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
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
        <AppSupportingText>Loading your Gen X Jumps account...</AppSupportingText>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
        <AppPanel className="w-full max-w-md p-6 sm:p-8">
          <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
            Private Access
          </p>
          <h1 className="gxj-display-title mt-3 text-3xl uppercase leading-[0.95] tracking-wide sm:text-4xl">
            Open Your Secure Access Link
          </h1>
          <AppSupportingText className="mt-3">
            We couldn&rsquo;t confirm a signed-in Gen X Jumps account in this browser.
          </AppSupportingText>
          <Button asChild className="mt-5 w-full sm:w-auto">
            <a href="/recover">Get a Magic Access Link</a>
          </Button>
          <a href="/account" className="mt-4 block text-sm font-medium underline underline-offset-4">
            Account and Log Out
          </a>
        </AppPanel>
      </div>
    );
  }

  return children;
}
