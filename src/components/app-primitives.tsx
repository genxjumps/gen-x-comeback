import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AppSection({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section
      className={cn("border-t-2 border-foreground/20 py-6 sm:py-8", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function AppSectionTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  return (
    <h2
      className={cn(
        "gxj-display-title text-2xl uppercase leading-none tracking-wide sm:text-3xl",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function AppQuestionTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  return (
    <h2 className={cn("text-xl font-bold leading-snug sm:text-2xl", className)} {...props}>
      {children}
    </h2>
  );
}

export function AppBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p className={cn("text-base font-medium leading-relaxed text-foreground/80", className)} {...props}>
      {children}
    </p>
  );
}

export function AppSupportingText({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function AppMeta({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p
      className={cn("text-xs font-bold uppercase tracking-[0.14em] text-foreground/60", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function AppPanel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("border border-foreground/20 bg-background p-4 sm:p-5", className)} {...props}>
      {children}
    </div>
  );
}
