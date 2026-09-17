import type { HTMLAttributes, ReactNode } from "react";

import { PuList, PuListRow } from "@/design-system/precision/components";

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
