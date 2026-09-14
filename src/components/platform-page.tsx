import type { ReactNode } from "react";

export function PlatformPage({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl pb-10 sm:pb-14">
      <header className="gxj-page-header py-7 sm:py-10">
        <div className="w-full max-w-2xl">
          <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">{kicker}</p>
          <h1 className="gxj-display-title mt-4 text-5xl uppercase leading-[0.95] tracking-wide sm:text-7xl">
            {title}
          </h1>
          <p className="mt-3 max-w-lg text-base font-medium leading-relaxed text-foreground/80 sm:text-lg">
            {description}
          </p>
        </div>
      </header>
      <div className="gxj-page-body mx-auto max-w-3xl">{children}</div>
    </div>
  );
}
