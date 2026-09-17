import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "gxj-display-title text-2xl uppercase leading-none tracking-wide sm:text-3xl",
        className,
      )}
      {...props}
    />
  );
}

export function BodyText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-base leading-relaxed text-foreground/80", className)} {...props} />;
}

export function SupportingText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />
  );
}

export function MetaText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-xs font-bold uppercase leading-tight tracking-[0.14em] text-foreground/60",
        className,
      )}
      {...props}
    />
  );
}

export function PageSection({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={cn("border-t-2 border-foreground/20 py-6 sm:py-8", className)} {...props}>
      {children}
    </section>
  );
}

export function ContainedPanel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section
      className={cn("border border-foreground/20 bg-background p-4 sm:p-5", className)}
      {...props}
    >
      {children}
    </section>
  );
}
