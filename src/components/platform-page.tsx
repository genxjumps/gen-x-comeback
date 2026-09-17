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
    <div className="gxj-page mx-auto min-h-full w-full max-w-[var(--pu-content-app)] pb-10 sm:pb-14">
      <header
        className={`gxj-page-header pt-7 sm:pt-10 ${
          contentGap === "tight" ? "pb-3 sm:pb-4" : "pb-7 sm:pb-10"
        }`}
      >
        {headerPrefix}
        <div className="w-full max-w-[var(--pu-content-reading)]">
          {kicker ? <p className="gxj-kicker">{kicker}</p> : null}
          <h1
            className={`gxj-display-title ${kicker || headerPrefix ? "mt-3" : ""} ${
              titleSize === "hero"
                ? "text-[2.75rem] leading-[0.96] tracking-[-0.03em] sm:text-[3.5rem]"
                : "text-[2rem] leading-[1.05] tracking-[-0.025em] sm:text-[2.5rem]"
            }`}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-xl text-base font-normal leading-6 text-[var(--pu-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
      </header>
      <div className="gxj-page-body mx-auto w-full max-w-[var(--pu-content-reading)]">
        {children}
      </div>
    </div>
  );
}
