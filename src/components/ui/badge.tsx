import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border-subtle)] bg-[var(--accent-blue-soft)] text-[var(--text-primary)]",
        nickname: "nickname-pill font-semibold",
        muted:
          "border-[var(--border-subtle)] bg-[var(--status-unmarked-bg)] text-[var(--status-unmarked-text)]",
        present:
          "border-[var(--status-present-border)] bg-[var(--status-present-bg)] text-[var(--status-present-text)]",
        absent:
          "border-[var(--status-absent-border)] bg-[var(--status-absent-bg)] text-[var(--status-absent-text)]",
        late: "border-[var(--status-late-border)] bg-[var(--status-late-bg)] text-[var(--status-late-text)]",
        other:
          "border-[var(--status-other-border)] bg-[var(--status-other-bg)] text-[var(--status-other-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
