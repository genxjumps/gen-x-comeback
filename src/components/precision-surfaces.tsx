import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import {
  PuList,
  PuListRow,
  PuLoadingLines,
  PuStatePanel,
} from "@/design-system/precision/components";

export function AppStatePanel({
  state,
  title,
  description,
  action,
  className,
}: {
  state: "empty" | "locked" | "error";
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <PuStatePanel
      state={state}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

export function AppLoadingState({
  label = "Loading",
  lines = 3,
  className,
}: {
  label?: string;
  lines?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-label={label} role="status">
      <PuLoadingLines lines={lines} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

const noticeBorder = {
  info: "var(--pu-accent-program)",
  success: "var(--pu-status-success)",
  warning: "var(--pu-status-warning)",
  danger: "var(--pu-status-danger)",
} as const;

export function AppNotice({
  tone = "info",
  children,
  className = "",
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: keyof typeof noticeBorder;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-[var(--pu-radius-control)] border border-[var(--pu-border-subtle)] border-l-4 bg-[var(--pu-surface-contained)] px-4 py-3.5 text-sm leading-relaxed text-[var(--pu-text-secondary)] ${className}`}
      style={{ borderLeftColor: noticeBorder[tone], ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function AppList({ children, className }: { children: ReactNode; className?: string }) {
  return <PuList className={className}>{children}</PuList>;
}

export function AppListRow({
  title,
  detail,
  end,
  className,
}: {
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return <PuListRow title={title} detail={detail} end={end} className={className} />;
}

export function AppLinearProgress({
  value,
  label,
  accent = "orange",
  className = "",
}: {
  value: number;
  label: string;
  accent?: "orange" | "aqua";
  className?: string;
}) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  const style = {
    width: `${normalized}%`,
    backgroundColor:
      accent === "aqua" ? "var(--pu-accent-program)" : "var(--pu-action-primary)",
  } as CSSProperties;

  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-[var(--pu-surface-subtle)] ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalized}
    >
      <div className="h-full rounded-full transition-[width] duration-[180ms]" style={style} />
    </div>
  );
}
