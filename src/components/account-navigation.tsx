import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { readStoredToken } from "@/lib/access-token";
import { getAccountIdentity, type AccountIdentityResult } from "@/lib/account/functions";
import {
  clearBrowserAccountData,
  logoutThisBrowser,
  LOGOUT_EVENT_KEY,
} from "@/lib/account/browser-session";

export function AccountNavigation() {
  const load = useServerFn(getAccountIdentity);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const [identity, setIdentity] = useState<AccountIdentityResult | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const loggingOut = useRef(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setIdentity(null);
        setRevision((value) => value + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    setIdentity(null);
    if (menu.current && !loggingOut.current) menu.current.open = false;
    void load({ data: { token: readStoredToken() } })
      .then((result) => {
        if (active && !loggingOut.current) setIdentity(result);
      })
      .catch(() => {
        if (active && !loggingOut.current) setIdentity({ ok: false });
      });
    return () => {
      active = false;
    };
  }, [load, pathname, revision]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && menu.current) {
        menu.current.open = false;
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  async function logOut() {
    if (loggingOut.current) return;
    loggingOut.current = true;
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
      // Keep a failed cleanup visible and retryable, even if Auth already signed out.
      loggingOut.current = false;
      setBusy(false);
      setError(true);
      if (menu.current) menu.current.open = true;
    }
  }

  if (identity?.ok && !identity.accountEmail && !identity.planEmail && !error && !busy) {
    return (
      <a
        href="/recover"
        className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Sign In
      </a>
    );
  }

  return (
    <details
      ref={menu}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
          event.stopPropagation();
        }
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          event.currentTarget.open = false;
        }
      }}
    >
      <summary
        aria-label="Account menu"
        className="grid size-11 cursor-pointer list-none place-items-center rounded-full border border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
      >
        <UserRound aria-hidden="true" className="size-5" />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2.5rem)] rounded-lg border border-border bg-background p-4 text-foreground shadow-lg">
        <AccountNavigationContent
          identity={identity}
          busy={busy}
          error={error}
          onLogOut={() => void logOut()}
        />
      </div>
    </details>
  );
}

export function AccountNavigationContent({
  identity,
  busy,
  error,
  onLogOut,
}: {
  identity: AccountIdentityResult | null;
  busy: boolean;
  error: boolean;
  onLogOut: () => void;
}) {
  const email = identity?.ok ? (identity.accountEmail ?? identity.planEmail) : null;
  return (
    <>
      {busy ? (
        <p role="status" className="text-sm">
          Logging Out...
        </p>
      ) : error ? (
        <p role="alert" className="text-sm">
          We couldn’t finish logging out. Check your connection and try again.
        </p>
      ) : identity === null ? (
        <p role="status" className="text-sm">
          Loading your account...
        </p>
      ) : email ? (
        <div className="text-sm">
          <p className="text-muted-foreground">Signed in as</p>
          <p className="mt-1 break-all font-semibold">{email}</p>
        </div>
      ) : (
        <p role="alert" className="text-sm">
          We couldn’t load your account details.
        </p>
      )}
      <nav aria-label="Account navigation" className="mt-3 grid gap-1 border-t border-border pt-2">
        <a
          href="/account"
          className="flex min-h-11 items-center rounded-md px-2 text-sm font-medium hover:bg-muted"
        >
          Account
        </a>
        {identity !== null || error || busy ? (
          <button
            type="button"
            disabled={busy}
            onClick={onLogOut}
            className="min-h-11 rounded-md px-2 text-left text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {busy ? "Logging Out..." : error ? "Try Logging Out Again" : "Log Out"}
          </button>
        ) : null}
      </nav>
    </>
  );
}
