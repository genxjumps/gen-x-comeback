import type { HTMLAttributes, ReactNode } from "react";

import { PuLoadingLines, PuNotice, PuStatePanel } from "@/design-system/precision/components";

export function AppLoading({ className, lines = 3 }: { className?: string; lines?: number }) {
  return <PuLoadingLines className={className} lines={lines} />;
}

export function AppState({
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

export function AppNotice({
  tone = "info",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  return (
    <PuNotice tone={tone} className={className} {...props}>
      {children}
    </PuNotice>
  );
}
