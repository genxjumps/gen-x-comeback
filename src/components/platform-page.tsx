import type { ReactNode } from "react";

export function PlatformPage({
  headerPrefix,
  kicker,
  title,
  description,
  titleSize = "compact",
  contentGap = "default",
  children,
}: {
  headerPrefix?: ReactNode;
  kicker?: string;
  title: string;
  description?: string;
  titleSize?: "compact" | "hero";
  contentGap?: "default" | "tight";
  children: ReactNode;
}) {
  return (
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl pb-10 sm:pb-14">
      <header
        className={`gxj-page-header pt-7 sm:pt-10 ${
          contentGap === "tight" ? "pb-2 sm:pb-4" : "pb-7 sm:pb-10"
        }`}
      >
        {headerPrefix}
        <div className="w-full max-w-2xl">
          {kicker ? (
            <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">{kicker}</p>
          ) : null}
          <h1
            className={`gxj-display-title uppercase leading-[0.95] tracking-wide ${
              kicker || headerPrefix ? "mt-4" : ""
            } ${titleSize === "hero" ? "text-5xl sm:text-7xl" : "text-3xl sm:text-4xl"}`}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-lg text-base font-medium leading-relaxed text-foreground/80">
              {description}
            </p>
          ) : null}
        </div>
      </header>
      <div className="gxj-page-body mx-auto max-w-3xl">{children}</div>
    </div>
  );
}
