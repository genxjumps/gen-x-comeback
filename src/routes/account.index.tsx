import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AccountPurchases } from "@/components/account-purchases";
import { AppSection, AppSectionTitle, AppSupportingText } from "@/components/app-primitives";
import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { readStoredToken } from "@/lib/access-token";
import { getAccountIdentity, type AccountIdentityResult } from "@/lib/account/functions";

export const Route = createFileRoute("/account/")({
  head: () => ({
    meta: [{ title: "My Account | Gen X Jumps" }, { name: "robots", content: "noindex, nofollow" }],
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
    <PlatformPage title="My Account" titleSize="compact">
      {identity === null ? (
        <AppSupportingText role="status">Loading your account...</AppSupportingText>
      ) : null}

      {identity && !identity.ok ? (
        <AppSection className="border-t-0 pt-0">
          <p role="alert">We couldn’t load your account details. Please try again.</p>
          <Button variant="outline" className="mt-4" onClick={() => setAttempt((n) => n + 1)}>
            Try Again
          </Button>
        </AppSection>
      ) : null}

      {email ? (
        <AppSection>
          <AppSectionTitle>Profile</AppSectionTitle>
          <AppSupportingText className="mt-4">Email</AppSupportingText>
          <p className="mt-1 break-all font-semibold">{email}</p>
          {identity?.ok &&
          identity.accountEmail &&
          identity.planEmail &&
          identity.planEmail !== email ? (
            <AppSupportingText className="mt-3 break-words text-foreground">
              This browser also has 7-Day Plan access for {identity.planEmail}. Logging out clears
              both.
            </AppSupportingText>
          ) : null}
        </AppSection>
      ) : null}

      {identity?.ok && identity.accountEmail ? (
        <AccountPurchases key={identity.accountEmail} />
      ) : null}

      {identity?.ok && !email ? (
        <AppSection>
          <p>You’re not signed in. Use a secure email link to open your account.</p>
          <Button asChild className="mt-5">
            <a href="/recover">Get a Magic Access Link</a>
          </Button>
        </AppSection>
      ) : null}
    </PlatformPage>
  );
}
