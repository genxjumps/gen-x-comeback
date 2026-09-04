import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Apple, Bell, ChartNoAxesColumnIncreasing, Compass, Dumbbell, Home } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { getPlatformNotifications } from "@/lib/notifications/functions";

const primaryNavigation = [
  { label: "Home", to: "/home", icon: Home },
  { label: "My Programs", to: "/my-programs", icon: Dumbbell },
  { label: "Progress", to: "/progress", icon: ChartNoAxesColumnIncreasing },
  { label: "Nutrition", to: "/nutrition", icon: Apple },
  { label: "Explore", to: "/programs", icon: Compass },
] as const;

function isActivePath(pathname: string, to: string): boolean {
  return pathname === to || (to === "/my-programs" && pathname === "/accelerator");
}

export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const loadNotifications = useServerFn(getPlatformNotifications);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    let active = true;
    void loadNotifications({ data: {} })
      .then((result) => {
        if (active && result.ok) setNotificationCount(result.notifications.length);
      })
      .catch(() => undefined);
    const updateCount = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") setNotificationCount(detail.count);
    };
    window.addEventListener("gxj:notifications-changed", updateCount);
    return () => {
      active = false;
      window.removeEventListener("gxj:notifications-changed", updateCount);
    };
  }, [loadNotifications, pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            to="/home"
            className="inline-block shrink-0 rounded-[2px] border border-solid border-foreground px-2.5 py-1.5 text-[11px] font-bold uppercase leading-none tracking-[0.16em]"
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
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            to="/notifications"
            aria-label={notificationCount > 0 ? "Notifications - unread reminder" : "Notifications"}
            aria-current={pathname === "/notifications" ? "page" : undefined}
            className={`relative grid size-10 place-items-center rounded-full border transition-colors ${
              pathname === "/notifications"
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-muted"
            }`}
          >
            <Bell aria-hidden="true" className="size-4" />
            {notificationCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive"
              />
            ) : null}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-8 pb-28 sm:px-8 sm:py-12 lg:pb-12">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/98 pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {primaryNavigation.map((item) => {
            const active = isActivePath(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.5 : 2} />
                <span>{item.label === "My Programs" ? "Programs" : item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
