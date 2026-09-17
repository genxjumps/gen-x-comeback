import type { ReactNode } from "react";

import {
  PuList,
  PuListRow,
  PuLoadingLines,
  PuNotice,
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

export function AppNotice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
  className?: string;
}) {
  return (
    <PuNotice tone={tone} className={className}>
      {children}
    </PuNotice>
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
