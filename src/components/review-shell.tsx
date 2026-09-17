import { Bell, ChartNoAxesColumnIncreasing, Dumbbell, Home, Apple, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { platformShellStyles as shell } from "@/components/platform-shell-styles";
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
  const actionClass =
    "relative grid size-10 place-items-center rounded-full border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] text-[var(--pu-text-primary)]";

  return (
    <div className="flex items-center gap-2">
      <span aria-label="Account menu" className={actionClass}>
        <UserRound aria-hidden="true" className="size-5" />
      </span>
      <span
        aria-label={unread ? "Notifications - unread reminder" : "Notifications"}
        className={actionClass}
      >
        <Bell aria-hidden="true" className="size-4" />
        {unread ? (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--pu-status-danger)]" />
        ) : null}
      </span>
    </div>
  );
}

function Brand() {
  return <span className={shell.brand}>Gen X Jumps</span>;
}

export function ReviewShell(props: {
  mode: ReviewShellMode;
  active?: "home" | "programs" | "progress" | "nutrition" | "none";
  accent?: "orange" | "aqua";
  unread?: boolean;
  children: ReactNode;
}) {
  const { mode, active = "home", unread = false, children } = props;

  if (mode !== "participant") {
    return (
      <div className={shell.shell}>
        <header className="border-b border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)]">
          <div
            className={`mx-auto flex h-[4.5rem] w-full items-center justify-between px-5 sm:px-8 ${
              mode === "public" ? "max-w-5xl" : "max-w-2xl"
            }`}
          >
            <Brand />
            {mode === "focused" ? <HeaderActions /> : null}
          </div>
        </header>
        <main className="gxj-app-surface flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className={shell.shell}>
      <header className={shell.header}>
        <div className={shell.headerInner}>
          <Brand />
          <nav className={shell.desktopNav} aria-label="Main navigation">
            {navigation.map((item) => {
              const selected = active === item.key;
              return (
                <a
                  key={item.key}
                  href={item.href}
                  aria-current={selected ? "page" : undefined}
                  className={`${shell.desktopItemBase} ${
                    selected ? shell.desktopItemActive : shell.desktopItemInactive
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <HeaderActions unread={unread} />
        </div>
      </header>

      <main className={shell.main}>{children}</main>

      <nav className={shell.mobileNav} aria-label="Main navigation">
        <div className={shell.mobileGrid}>
          {navigation.map((item) => {
            const Icon = item.icon;
            const selected = active === item.key;
            return (
              <a
                key={item.key}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={`${shell.mobileItemBase} ${
                  selected ? shell.mobileItemActive : shell.mobileItemInactive
                }`}
              >
                <Icon aria-hidden="true" className="size-6" strokeWidth={selected ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
