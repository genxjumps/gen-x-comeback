import { Check, Clock3, Dumbbell, LockKeyhole, Play } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
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
  return (
    <p
      className={cn(
        tone === "body" ? "pu-body" : tone === "support" ? "pu-support" : "pu-meta",
        className,
      )}
      {...props}
    />
  );
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
      className={cn("pu-button", `pu-button--${variant}`, `pu-button--${size}`, className)}
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
      <input id={id} className="pu-input" aria-describedby={helpId} {...inputProps} />
      {help ? (
        <span id={helpId} className="pu-help">
          {help}
        </span>
      ) : null}
    </div>
  );
}

export function PuSelect({
  id,
  label,
  help,
  className,
  children,
  selectProps,
}: {
  id: string;
  label: string;
  help?: string;
  className?: string;
  children: ReactNode;
  selectProps?: Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">;
}) {
  const helpId = help ? `${id}-help` : undefined;
  return (
    <div className={cn("pu-field", className)}>
      <label className="pu-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="pu-select" aria-describedby={helpId} {...selectProps}>
        {children}
      </select>
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

export function PuCheckboxChoice({
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
    <label className="pu-choice pu-choice--check" data-selected={checked ? "true" : "false"}>
      <input
        className="pu-visually-hidden"
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span className="pu-choice__marker" aria-hidden="true">
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
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
    <div
      className={cn("pu-progress", className)}
      aria-label={label}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={steps}
      aria-valuenow={currentStep}
      style={style}
    >
      {Array.from({ length: steps }, (_, index) => {
        const step = index + 1;
        const state =
          step < currentStep ? "complete" : step === currentStep ? "current" : "upcoming";
        return (
          <span key={step} className="pu-progress__step" data-state={state} aria-hidden="true" />
        );
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

export function PuList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pu-list", className)} {...props} />;
}

export function PuListRow({
  title,
  detail,
  end,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <div className={cn("pu-list-row", className)} {...props}>
      <div>
        <div className="pu-list-row__title">{title}</div>
        {detail ? <div className="pu-list-row__detail">{detail}</div> : null}
      </div>
      {end ? <div className="pu-list-row__end">{end}</div> : null}
    </div>
  );
}

export function PuStatePanel({
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
    <div className={cn("pu-state-panel", `pu-state-panel--${state}`, className)}>
      <PuHeading level={3}>{title}</PuHeading>
      {description ? <div className="pu-state-panel__description">{description}</div> : null}
      {action ? <div className="pu-state-panel__action">{action}</div> : null}
    </div>
  );
}

export function PuLoadingLines({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("pu-loading", className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="pu-loading__line" data-line={index + 1} aria-hidden="true" />
      ))}
    </div>
  );
}

type WorkoutState = "ready" | "completed" | "locked" | "in-progress" | "scheduled";
type WorkoutMediaSize = "card" | "hero" | "row";

export function PuWorkoutMedia({
  program,
  week,
  workoutNumber,
  title,
  subtitle,
  duration,
  level,
  equipment,
  state = "ready",
  progress,
  size = "card",
  actionLabel = "Start workout",
  onAction,
  className,
}: {
  program?: string;
  week?: number | string;
  workoutNumber?: number | string;
  title: string;
  subtitle?: string;
  duration?: string;
  level?: string;
  equipment?: string;
  state?: WorkoutState;
  progress?: number;
  size?: WorkoutMediaSize;
  actionLabel?: string;
  onAction?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  className?: string;
}) {
  const numberLabel =
    workoutNumber === undefined ? undefined : String(workoutNumber).padStart(2, "0");
  const kicker = [
    program,
    week !== undefined ? `Week ${week}` : undefined,
    workoutNumber !== undefined ? `Workout ${workoutNumber}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const normalizedProgress = Math.max(0, Math.min(100, progress ?? 50));
  const overlayLabel =
    state === "completed"
      ? "Completed"
      : state === "locked"
        ? "Locked"
        : state === "in-progress"
          ? "In progress"
          : state === "scheduled"
            ? "Scheduled"
            : undefined;

  return (
    <article
      className={cn("pu-workout-media", className)}
      data-state={state}
      data-size={size}
      aria-label={`${title}${overlayLabel ? ` - ${overlayLabel}` : ""}`}
    >
      <div className="pu-workout-media__graphics" aria-hidden="true" />
      <div className="pu-workout-media__inner">
        <div className="pu-workout-media__topline">
          <span className="pu-workout-media__kicker">{kicker}</span>
          {numberLabel ? <span className="pu-workout-media__number">{numberLabel}</span> : null}
        </div>
        <div className="pu-workout-media__content">
          <h3 className="pu-workout-media__title">{title}</h3>
          {subtitle ? <p className="pu-workout-media__subtitle">{subtitle}</p> : null}
        </div>
        <div className="pu-workout-media__footer">
          <div className="pu-workout-media__stats">
            {duration ? (
              <span>
                <Clock3 aria-hidden="true" />
                {duration}
              </span>
            ) : null}
            {level ? <span>{level}</span> : null}
            {equipment ? (
              <span>
                <Dumbbell aria-hidden="true" />
                {equipment}
              </span>
            ) : null}
          </div>
          {state === "ready" ? (
            <button
              type="button"
              className="pu-workout-media__action"
              onClick={onAction}
              aria-label={actionLabel}
            >
              <Play aria-hidden="true" fill="currentColor" />
            </button>
          ) : null}
        </div>
      </div>

      {state !== "ready" ? (
        <div className="pu-workout-media__overlay">
          {state === "completed" ? (
            <span className="pu-workout-media__state-icon">
              <Check aria-hidden="true" />
            </span>
          ) : null}
          {state === "locked" ? (
            <span className="pu-workout-media__state-icon">
              <LockKeyhole aria-hidden="true" />
            </span>
          ) : null}
          {state === "in-progress" ? (
            <span
              className="pu-workout-media__progress-ring"
              style={{ "--pu-workout-progress": `${normalizedProgress}%` } as CSSProperties}
              aria-hidden="true"
            >
              <span>{normalizedProgress}%</span>
            </span>
          ) : null}
          <strong>{overlayLabel}</strong>
          <span className="pu-workout-media__overlay-copy">
            {state === "completed"
              ? "Workout complete"
              : state === "locked"
                ? "Available later"
                : state === "in-progress"
                  ? "Resume workout"
                  : "Not available yet"}
          </span>
        </div>
      ) : null}
    </article>
  );
}
