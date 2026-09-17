import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-12 w-full rounded-[var(--pu-radius-control)] border border-[var(--pu-border-strong)] bg-[var(--pu-surface-contained)] px-3.5 py-2 text-base text-[var(--pu-text-primary)] transition-[border-color,box-shadow] duration-[120ms] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--pu-text-primary)] placeholder:text-[var(--pu-text-secondary)] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
