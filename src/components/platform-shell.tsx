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
    <div className="gxj-platform-shell min-h-screen bg-[var(--pu-surface-page)] text-[var(--pu-text-primary)]">
      <header className="gxj-platform-header sticky top-0 z-30 border-b border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] text-[var(--pu-text-primary)]">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-[var(--pu-content-app)] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link
            to="/home"
            className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--pu-radius-control)] border border-[var(--pu-border-strong)] px-3 text-xs font-bold uppercase leading-none tracking-[0.12em] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px]"
          >
            Gen X Jumps
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {primaryNavigation.map((item) => {
              const active = isActivePath(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`min-h-11 rounded-[var(--pu-radius-control)] px-3.5 py-3 text-sm font-bold transition-colors duration-[120ms] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px] ${
                    active
                      ? "bg-[var(--pu-surface-subtle)] text-[var(--pu-text-primary)]"
                      : "text-[var(--pu-text-secondary)] hover:bg-[var(--pu-surface-subtle)] hover:text-[var(--pu-text-primary)]"
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

      <main className="gxj-app-surface mx-auto w-full max-w-[var(--pu-content-app)] px-5 pb-28 sm:px-8 lg:px-10 lg:pb-14">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] text-[var(--pu-text-primary)] pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1 p-2">
          {primaryNavigation.map((item) => {
            const active = isActivePath(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-[var(--pu-radius-control)] px-1 text-xs font-bold transition-colors duration-[120ms] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[-1px] ${
                  active
                    ? "bg-[var(--pu-surface-subtle)] text-[var(--pu-text-primary)]"
                    : "text-[var(--pu-text-secondary)]"
                }`}
              >
                <Icon aria-hidden="true" className="size-6" strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
