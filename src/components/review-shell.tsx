import { Bell, ChartNoAxesColumnIncreasing, Dumbbell, Home, Apple, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import type { ReviewShell as ReviewShellMode } from "@/lib/app-review";

const navigation = [
  { label: "Home", href: "/review/home-seven-day", icon: Home, key: "home" },
  { label: "Programs", href: "/review/programs-active", icon: Dumbbell, key: "programs" },
  {
    label: "Progress",
    href: "/review/progress-active",
    icon: ChartNoAxesColumnIncreasing,
    key: "progress",
  },
  { label: "Nutrition", href: "/review/nutrition-active", icon: Apple, key: "nutrition" },
] as const;

function HeaderActions({ unread = false }: { unread?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-label="Account menu"
        className="grid size-10 place-items-center rounded-full border border-foreground/25"
      >
        <UserRound aria-hidden="true" className="size-5" />
      </span>
      <span
        aria-label={unread ? "Notifications - unread reminder" : "Notifications"}
        className="relative grid size-10 place-items-center rounded-full border border-foreground/25"
      >
        <Bell aria-hidden="true" className="size-4" />
        {unread ? (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" />
        ) : null}
      </span>
    </div>
  );
}

function Brand() {
  return (
    <span className="inline-block shrink-0 rounded-[2px] border border-solid border-foreground px-2.5 py-1.5 text-[11px] font-bold uppercase leading-none tracking-[0.16em]">
      Gen X Jumps
    </span>
  );
}

export function ReviewShell({
  mode,
  active = "home",
  unread = false,
  children,
}: {
  mode: ReviewShellMode;
  active?: "home" | "programs" | "progress" | "nutrition" | "none";
  unread?: boolean;
  children: ReactNode;
}) {
  if (mode !== "participant") {
    return (
      <div className="gxj-platform-shell flex min-h-screen flex-col bg-background text-foreground">
        <header className="relative z-10 border-b border-foreground/15 bg-background/95">
          <div className="mx-auto flex h-[4.5rem] w-full max-w-2xl items-center justify-between px-5">
            <Brand />
            {mode === "focused" ? <HeaderActions /> : null}
          </div>
        </header>
        <main className="gxj-app-surface flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="gxj-platform-shell min-h-screen bg-background text-foreground">
      <header className="gxj-platform-header sticky top-0 z-30 border-b border-foreground/15 bg-background/95 text-foreground shadow-[0_2px_12px_oklch(0_0_0/6%)] backdrop-blur-sm">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-1.5 lg:flex" aria-label="Main navigation">
            {navigation.map((item) => (
              <a
                key={item.key}
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
                className={`relative min-h-11 px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] ${
                  active === item.key
                    ? "text-foreground after:absolute after:inset-x-4 after:bottom-1.5 after:h-0.5 after:bg-gxj-orange"
                    : "text-foreground/55"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <HeaderActions unread={unread} />
        </div>
      </header>
      <main className="gxj-app-surface mx-auto w-full max-w-6xl px-5 pb-28 sm:px-8 lg:pb-14">
        {children}
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-foreground/15 bg-background/95 shadow-[0_-3px_14px_oklch(0_0_0/8%)] backdrop-blur-sm pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const selected = active === item.key;
            return (
              <a
                key={item.key}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 px-1 text-xs font-bold uppercase tracking-[0.05em] ${
                  selected
                    ? "text-foreground after:absolute after:inset-x-3 after:top-0 after:h-0.5 after:bg-gxj-orange"
                    : "text-foreground/50"
                }`}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={selected ? 2.5 : 2} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
