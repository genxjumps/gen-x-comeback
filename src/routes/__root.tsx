import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { AccountNavigation } from "@/components/account-navigation";
import { AccountSessionSync } from "@/components/account-session-sync";
import { AppState } from "@/components/app-state";
import { AuthSessionBootstrap } from "@/components/auth-session-bootstrap";
import { PlatformAccessBoundary } from "@/components/platform-access-boundary";
import { PlatformHeaderActions } from "@/components/platform-header-actions";
import { PlatformShell } from "@/components/platform-shell";
import { PwaInstallCapture } from "@/components/pwa-install";
import { Button } from "@/components/ui/button";
import precisionComponentsCss from "../design-system/precision/components.css?url";
import precisionMigrationCss from "../design-system/precision/app-migration.css?url";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5">
      <AppState
        state="empty"
        title="Page Not Found"
        description="The page you're looking for doesn't exist or has been moved."
        action={
          <Button asChild className="w-full sm:w-auto">
            <Link to="/">Go home</Link>
          </Button>
        }
      />
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5">
      <AppState
        state="error"
        title="This Page Didn't Load"
        description="Something went wrong on our end. You can try refreshing or head back home."
        action={
          <div className="grid gap-3 sm:flex">
            <Button
              type="button"
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="w-full sm:w-auto"
            >
              Try again
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href="/">Go home</a>
            </Button>
          </div>
        }
      />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f5f2ea" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Gen X Jumps" },
      { title: "Free Personalized 7-Day Fitness Plan for Gen X" },
      {
        name: "description",
        content:
          "Get a personalized workout and protein plan built around your current fitness level, physical considerations, available equipment, and realistic schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: precisionMigrationCss,
      },
      {
        rel: "stylesheet",
        href: precisionComponentsCss,
      },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="gxj-pu">
        <PwaInstallCapture />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inAssessment = pathname === "/assessment" || pathname.startsWith("/assessment/");
  const inOnboarding = pathname === "/welcome" || pathname === "/plan-ready";
  const inPlan = pathname === "/your-plan" || pathname.startsWith("/your-plan/");
  const inJumpRopes = pathname === "/jump-ropes";
  const inCheckoutSuccess = pathname === "/checkout/accelerator/success";
  const inAcceleratorOffer = pathname === "/programs/accelerator";
  const inAccount = pathname === "/account" || pathname === "/account/";
  const inReview = pathname === "/review" || pathname.startsWith("/review/");
  const useParticipantHeaderActions = inCheckoutSuccess || inAcceleratorOffer;
  const inParticipantPlan = inPlan || inJumpRopes;
  const inPlatform =
    pathname === "/home" ||
    pathname === "/my-programs" ||
    pathname === "/my-programs/accelerator/setup" ||
    pathname === "/my-programs/accelerator/runs" ||
    pathname === "/progress" ||
    pathname === "/nutrition" ||
    pathname === "/programs" ||
    pathname === "/notifications" ||
    pathname === "/accelerator" ||
    pathname === "/admin/customers" ||
    pathname === "/admin/refunds" ||
    pathname === "/account/purchases" ||
    pathname === "/my-programs/accelerator/refund";

  if (inReview) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    );
  }

  if (inPlatform || inAccount || inParticipantPlan) {
    return (
      <QueryClientProvider client={queryClient}>
        <AccountSessionSync />
        <PlatformShell>
          {inAccount || inParticipantPlan ? (
            <>
              <AuthSessionBootstrap />
              <Outlet />
            </>
          ) : (
            <PlatformAccessBoundary>
              <Outlet />
            </PlatformAccessBoundary>
          )}
        </PlatformShell>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AccountSessionSync />
      <AuthSessionBootstrap />
      <div className="gxj-platform-shell flex min-h-screen flex-col bg-background text-foreground">
        <header className="border-b border-border bg-[var(--pu-surface-contained)]">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-4">
            {inAssessment || inOnboarding ? (
              <span className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--pu-radius-control)] border border-[var(--pu-border-strong)] px-3 text-xs font-bold uppercase leading-none tracking-[0.12em]">
                Gen X Jumps
              </span>
            ) : (
              <Link
                to={inCheckoutSuccess ? "/home" : "/"}
                className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--pu-radius-control)] border border-[var(--pu-border-strong)] px-3 text-xs font-bold uppercase leading-none tracking-[0.12em] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px]"
              >
                Gen X Jumps
              </Link>
            )}
            <div className="ml-auto shrink-0">
              {useParticipantHeaderActions ? <PlatformHeaderActions /> : <AccountNavigation />}
            </div>
          </div>
        </header>

        <main className="gxj-app-surface flex-1">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto w-full max-w-2xl px-5 py-6 text-xs text-muted-foreground" />
        </footer>
      </div>
    </QueryClientProvider>
  );
}
