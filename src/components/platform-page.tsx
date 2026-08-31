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
    <div className="mx-auto w-full max-w-4xl">
      <header>
        <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">{kicker}</p>
        <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      </header>
      <div className="mt-8">{children}</div>
    </div>
  );
}
