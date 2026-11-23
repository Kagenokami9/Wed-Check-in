"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[background-color,border-color,color,opacity,transform] duration-150 cursor-pointer disabled:pointer-events-none disabled:opacity-45 select-none active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_6px_rgba(16,19,24,0.12)] hover:opacity-92",
        glass:
          "liquid-glass-panel text-[var(--text-primary)] hover:border-[var(--border-strong)]",
        outline:
          "border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--accent-blue-soft)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)]",
        destructive:
          "bg-[var(--status-absent-border)] text-white shadow-sm hover:opacity-92",
        success:
          "border border-[var(--cta-present-border)] bg-[var(--cta-present-bg)] text-[var(--cta-present-text)] hover:bg-[var(--cta-present-hover)]",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-9 rounded-lg px-3 text-xs",
        lg: "min-h-12 rounded-xl px-5 text-sm font-semibold",
        icon: "h-11 w-11 rounded-xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
