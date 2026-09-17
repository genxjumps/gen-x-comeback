import { Link, useRouterState } from "@tanstack/react-router";
import { Apple, ChartNoAxesColumnIncreasing, Dumbbell, Home } from "lucide-react";
import { type ReactNode } from "react";

import { PlatformHeaderActions } from "@/components/platform-header-actions";
import { platformShellStyles as shell } from "@/components/platform-shell-styles";

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
    <div className={shell.shell}>
      <header className={shell.header}>
        <div className={shell.headerInner}>
          <Link to="/home" className={shell.brand}>
            Gen X Jumps
          </Link>

          <nav className={shell.desktopNav} aria-label="Main navigation">
            {primaryNavigation.map((item) => {
              const active = isActivePath(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`${shell.desktopItemBase} ${
                    active ? shell.desktopItemActive : shell.desktopItemInactive
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

      <main className={shell.main}>{children}</main>

      <nav className={shell.mobileNav} aria-label="Main navigation">
        <div className={shell.mobileGrid}>
          {primaryNavigation.map((item) => {
            const active = isActivePath(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`${shell.mobileItemBase} ${
                  active ? shell.mobileItemActive : shell.mobileItemInactive
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
