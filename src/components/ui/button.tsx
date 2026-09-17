import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-w-0 items-center justify-center gap-2 whitespace-normal rounded-[var(--pu-radius-control)] border text-center font-semibold cursor-pointer transition-[background-color,border-color,color,box-shadow,transform] duration-[120ms] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px] disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-[var(--pu-action-primary)] bg-[var(--pu-action-primary)] text-white hover:border-[var(--pu-action-primary-hover)] hover:bg-[var(--pu-action-primary-hover)] active:translate-y-px",
        destructive:
          "border-[var(--pu-status-danger)] bg-[var(--pu-status-danger)] text-white hover:brightness-95",
        outline:
          "border-[var(--pu-border-strong)] bg-[var(--pu-surface-contained)] text-[var(--pu-text-primary)] hover:bg-[var(--pu-surface-subtle)]",
        secondary:
          "border-[var(--pu-border-strong)] bg-[var(--pu-surface-contained)] text-[var(--pu-text-primary)] hover:bg-[var(--pu-surface-subtle)]",
        ghost:
          "border-[var(--pu-border-subtle)] bg-transparent text-[var(--pu-text-primary)] hover:bg-[var(--pu-surface-subtle)]",
        link: "border-transparent bg-transparent text-[var(--pu-action-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-[1.125rem] py-2 text-[0.9375rem]",
        sm: "min-h-10 px-3.5 py-1.5 text-sm",
        lg: "min-h-[3.25rem] px-[1.375rem] py-2 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button };
