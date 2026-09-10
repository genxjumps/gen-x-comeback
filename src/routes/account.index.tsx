import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AccountPurchases } from "@/components/account-purchases";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { readStoredToken } from "@/lib/access-token";
import { getAccountIdentity, type AccountIdentityResult } from "@/lib/account/functions";
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
  const [identity, setIdentity] = useState<AccountIdentityResult | null>(null);
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

  const email = identity?.ok ? (identity.accountEmail ?? identity.planEmail) : null;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="gxj-kicker text-xs font-semibold uppercase tracking-widest">Account</p>
      <h1 className="gxj-display-title mt-3 text-3xl">Your Account</h1>
      {identity === null ? (
        <p className="mt-5" role="status">
          Loading your account...
        </p>
      ) : null}
      {identity && !identity.ok ? (
        <div className="mt-5">
          <p role="alert">We couldn’t load your account details. Please try again.</p>
          <Button variant="outline" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>
            Try Again
          </Button>
        </div>
      ) : null}
      {email ? (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Profile</h2>
          <p className="mt-4 text-sm text-muted-foreground">Email</p>
          <p className="mt-1 break-all font-semibold">{email}</p>
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
      {identity?.ok && identity.accountEmail ? (
        <AccountPurchases key={identity.accountEmail} />
      ) : null}
      {identity?.ok && !email ? (
        <div className="mt-6">
          <p>You’re not signed in. Use a secure email link to open your account.</p>
          <Button asChild className="mt-5">
            <a href="/recover">Send Me a Sign-In Link</a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
