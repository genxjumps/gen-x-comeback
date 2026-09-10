import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { readStoredToken } from "@/lib/access-token";
import { getAccountIdentity, type AccountIdentityResult } from "@/lib/account/functions";
import {
  clearBrowserAccountData,
  logoutThisBrowser,
  LOGOUT_EVENT_KEY,
} from "@/lib/account/browser-session";

export const Route = createFileRoute("/account/")({
  head: () => ({
    meta: [
      { title: "Your Account | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Account,
});

function Account() {
  const load = useServerFn(getAccountIdentity);
  const queryClient = useQueryClient();
  const [identity, setIdentity] = useState<AccountIdentityResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setIdentity(null);
        setAttempt((n) => n + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    void load({ data: { token: readStoredToken() } })
      .then((result) => active && setIdentity(result))
      .catch(() => active && setIdentity({ ok: false }));
    return () => {
      active = false;
    };
  }, [load, attempt]);

  async function logOut() {
    setBusy(true);
    setError(false);
    const ok = await logoutThisBrowser(readStoredToken(), {
      clearServerSession: async (token) => {
        const response = await fetch("/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        return response.ok && (await response.json()).ok === true;
      },
      clearData: clearBrowserAccountData,
      signOut: () => supabase.auth.signOut({ scope: "local" }),
      announce: () => window.localStorage.setItem(LOGOUT_EVENT_KEY, crypto.randomUUID()),
    });
    queryClient.clear();
    setIdentity({ ok: true, accountEmail: null, planEmail: null });
    if (ok) window.location.replace("/account");
    else {
      setError(true);
      setBusy(false);
    }
  }

  const email = identity?.ok ? (identity.accountEmail ?? identity.planEmail) : null;
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <p className="gxj-kicker text-xs font-semibold uppercase tracking-widest">Account</p>
      <h1 className="gxj-display-title mt-3 text-3xl">Your Account</h1>
      {identity === null ? (
        <p className="mt-5" role="status">
          Loading your account...
        </p>
      ) : null}
      {identity && !identity.ok ? (
        <div className="mt-5">
          <p role="alert">We couldn’t load your account details. You can try again or log out.</p>
          <Button variant="outline" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>
            Try Again
          </Button>
        </div>
      ) : null}
      {email && !error ? (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="mt-1 break-all font-semibold">{email}</p>
          <a
            href={identity?.ok && identity.accountEmail ? "/home" : "/your-plan"}
            className="mt-4 inline-block text-sm underline"
          >
            Back to My Programs
          </a>
          {identity?.ok &&
          identity.accountEmail &&
          identity.planEmail &&
          identity.planEmail !== email ? (
            <p className="mt-3 text-sm break-words">
              This browser also has 7-Day Plan access for {identity.planEmail}. Logging out clears
              both.
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-5">
          We couldn’t finish logging out. Check your connection and try again.
        </p>
      ) : identity?.ok && !email ? (
        <div className="mt-6">
          <p>You’re not signed in. Use a secure email link to open your account.</p>
          <Button asChild className="mt-5">
            <a href="/recover">Send Me a Sign-In Link</a>
          </Button>
        </div>
      ) : null}
      {identity !== null ? (
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            Log out of this browser or installed app. Your saved programs and progress stay safe.
            Unsaved assessment answers in this browser will be cleared. Other devices stay signed
            in.
          </p>
          <Button className="mt-4" disabled={busy} onClick={() => void logOut()}>
            {busy ? "Logging Out..." : error ? "Try Logging Out Again" : "Log Out"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
