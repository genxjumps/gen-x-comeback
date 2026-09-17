import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { PuList, PuListRow } from "@/design-system/precision/components";
import { cn } from "@/lib/utils";

export function AppList(props: HTMLAttributes<HTMLDivElement>) {
  return <PuList {...props} />;
}

export function AppListRow({
  title,
  detail,
  end,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
}) {
  return <PuListRow title={title} detail={detail} end={end} {...props} />;
}

export function AppListLink({
  href,
  title,
  detail,
  end,
  className,
}: {
  href: string;
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "block rounded-[var(--pu-radius-control)] no-underline transition-colors duration-[120ms] hover:bg-[var(--pu-surface-subtle)] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px]",
        className,
      )}
    >
      <PuListRow title={title} detail={detail} end={end} />
    </a>
  );
}

export function AppListButton({
  title,
  detail,
  end,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "block w-full rounded-[var(--pu-radius-control)] bg-transparent text-left transition-colors duration-[120ms] hover:bg-[var(--pu-surface-subtle)] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px] disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <PuListRow title={title} detail={detail} end={end} />
    </button>
  );
}
