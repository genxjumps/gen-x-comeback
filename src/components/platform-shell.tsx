import { Link, useRouterState } from "@tanstack/react-router";
import { Apple, ChartNoAxesColumnIncreasing, Dumbbell, Home } from "lucide-react";
import { type ReactNode } from "react";

import { PlatformHeaderActions } from "@/components/platform-header-actions";

const primaryNavigation = [
  { label: "Home", to: "/home", icon: Home },
  { label: "Programs", to: "/my-programs", icon: Dumbbell },
  { label: "Progress", to: "/progress", icon: ChartNoAxesColumnIncreasing },
  { label: "Nutrition", to: "/nutrition", icon: Apple },
] as const;

function isActivePath(pathname: string, to: string): boolean {
  if (to !== "/my-programs") return pathname === to;
  return (
    pathname === "/accelerator" ||
    pathname === "/my-programs" ||
    pathname.startsWith("/my-programs/") ||
    pathname === "/programs" ||
    pathname.startsWith("/programs/")
  );
}

export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="gxj-platform-shell min-h-screen bg-background text-foreground">
      <header className="gxj-platform-header sticky top-0 z-30 border-b border-foreground/15 bg-background/95 text-foreground shadow-[0_2px_12px_oklch(0_0_0/6%)] backdrop-blur-sm">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            to="/home"
            className="group flex shrink-0 items-center gap-2 border border-foreground/25 px-2.5 py-2 text-xs font-black uppercase leading-none tracking-[0.14em] transition-colors hover:border-foreground/45 hover:bg-foreground/[0.04]"
          >
            <span>Gen X</span>
            <span className="text-gxj-orange">Jumps</span>
          </Link>

          <nav className="hidden items-center gap-1.5 lg:flex" aria-label="Main navigation">
            {primaryNavigation.map((item) => {
              const active = isActivePath(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`relative min-h-11 px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] transition-colors ${
                    active
                      ? "text-foreground after:absolute after:inset-x-4 after:bottom-1.5 after:h-0.5 after:bg-gxj-orange"
                      : "text-foreground/55 hover:bg-foreground/[0.04] hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <PlatformHeaderActions />
        </div>
      </header>

      <main className="gxj-app-surface mx-auto w-full max-w-6xl px-5 py-7 pb-28 sm:px-8 sm:py-10 lg:pb-14">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-foreground/15 bg-background/95 text-foreground shadow-[0_-3px_14px_oklch(0_0_0/8%)] backdrop-blur-sm pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {primaryNavigation.map((item) => {
            const active = isActivePath(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 px-1 text-xs font-bold uppercase tracking-[0.05em] transition-colors ${
                  active
                    ? "text-foreground after:absolute after:inset-x-3 after:top-0 after:h-0.5 after:bg-gxj-orange"
                    : "text-foreground/50"
                }`}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
