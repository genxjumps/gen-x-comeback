import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export function PuShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("gxj-pu", className)} {...props} />;
}

export function PuContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pu-shell", className)} {...props} />;
}

export function PuReadingWidth({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pu-reading", className)} {...props} />;
}

export function PuEyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("pu-eyebrow", className)} {...props} />;
}

export function PuHeading({
  level,
  hero = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & {
  level: 1 | 2 | 3;
  hero?: boolean;
  children: ReactNode;
}) {
  const Component = `h${level}` as const;
  const sizeClass = hero ? "pu-hero" : level === 1 ? "pu-h1" : level === 2 ? "pu-h2" : "pu-h3";
  return (
    <Component className={cn(sizeClass, className)} {...props}>
      {children}
    </Component>
  );
}

export function PuText({
  tone = "body",
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { tone?: "body" | "support" | "meta" }) {
  return <p className={cn(tone === "body" ? "pu-body" : tone === "support" ? "pu-support" : "pu-meta", className)} {...props} />;
}

export function PuButton({
  variant = "primary",
  size = "standard",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
  size?: "compact" | "standard" | "major";
}) {
  return (
    <button
      type={type}
      className={cn(
        "pu-button",
        `pu-button--${variant}`,
        `pu-button--${size}`,
        className,
      )}
      {...props}
    />
  );
}

export function PuPanel({
  strong = false,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { strong?: boolean }) {
  return <section className={cn("pu-panel", strong && "pu-panel--strong", className)} {...props} />;
}

export function PuSection({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("pu-section", className)} {...props} />;
}

export function PuField({
  id,
  label,
  help,
  className,
  inputProps,
}: {
  id: string;
  label: string;
  help?: string;
  className?: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "id">;
}) {
  const helpId = help ? `${id}-help` : undefined;
  return (
    <div className={cn("pu-field", className)}>
      <label className="pu-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="pu-input"
        aria-describedby={helpId}
        {...inputProps}
      />
      {help ? (
        <span id={helpId} className="pu-help">
          {help}
        </span>
      ) : null}
    </div>
  );
}

export function PuRadioChoice({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
}) {
  return (
    <label className="pu-choice" data-selected={checked ? "true" : "false"}>
      <input
        className="pu-visually-hidden"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span className="pu-choice__marker" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function PuProgress({
  currentStep,
  steps,
  label,
  className,
}: {
  currentStep: number;
  steps: number;
  label: string;
  className?: string;
}) {
  const style = { "--pu-progress-steps": steps } as CSSProperties;
  return (
    <div className={cn("pu-progress", className)} aria-label={label} role="progressbar" aria-valuemin={1} aria-valuemax={steps} aria-valuenow={currentStep} style={style}>
      {Array.from({ length: steps }, (_, index) => {
        const step = index + 1;
        const state = step < currentStep ? "complete" : step === currentStep ? "current" : "upcoming";
        return <span key={step} className="pu-progress__step" data-state={state} aria-hidden="true" />;
      })}
    </div>
  );
}

export function PuNotice({
  tone = "info",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  return (
    <div className={cn("pu-notice", `pu-notice--${tone}`, className)} {...props}>
      {children}
    </div>
  );
}

export function PuNav({
  items,
  current,
  label = "Primary",
}: {
  items: readonly string[];
  current: string;
  label?: string;
}) {
  return (
    <nav className="pu-nav" aria-label={label}>
      {items.map((item) => (
        <a
          key={item}
          href={`#${item.toLowerCase()}`}
          className="pu-nav__item"
          aria-current={item === current ? "page" : undefined}
        >
          {item}
        </a>
      ))}
    </nav>
  );
}
