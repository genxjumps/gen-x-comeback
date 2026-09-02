import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

export const PLATFORM_AUTH_FRAGMENT_KEY = "gxj_auth";

/**
 * Completes the trusted server-created Supabase magic-link handoff after a
 * deliberate secure-link exchange. The token hash is carried in the URL
 * fragment so it is never sent to the application server or in referrers.
 *
 * The existing 7-Day return-session cookie remains authoritative for the
 * legacy plan routes. This bridge only adds the persistent Supabase browser
 * session required by Home / My Programs / Accelerator.
 */
export function AuthSessionBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const fragment = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const tokenHash = new URLSearchParams(fragment).get(PLATFORM_AUTH_FRAGMENT_KEY);
    if (!tokenHash) return;

    // Capture the token in memory, then immediately remove it from the visible
    // URL before making the verification request. The 7-Day session still works
    // even if this best-effort platform-session bridge fails.
    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(window.history.state, "", cleanUrl);

    let active = true;
    void supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: "email" })
      .then(({ error }) => {
        if (error && active) {
          console.error("[Auth] Could not establish the Gen X Jumps member session.", error);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          console.error("[Auth] Could not establish the Gen X Jumps member session.", error);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
