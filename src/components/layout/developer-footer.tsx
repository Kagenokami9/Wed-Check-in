import React from "react";
import { cn } from "@/lib/utils";

interface DeveloperFooterProps {
  className?: string;
  clearStickyBar?: boolean;
}

export function DeveloperFooter({
  className,
  clearStickyBar = false,
}: DeveloperFooterProps) {
  return (
    <footer
      className={cn(
        "mt-auto w-full border-t border-[var(--border-subtle)]/70 px-4 py-5 text-center text-xs text-[var(--text-muted)] sm:px-6 lg:px-8",
        clearStickyBar && "pb-24 sm:pb-24",
        className
      )}
    >
      <p className="mx-auto max-w-6xl">
        <span className="font-display tracking-[0.12em] text-[var(--text-secondary)] uppercase">
          BLUE CHECK-IN
        </span>
        <span aria-hidden="true" className="mx-2 opacity-60">
          ·
        </span>
        <span>
          พัฒนาโดย{" "}
          <span className="font-medium text-[var(--text-secondary)]">
            นายธารินทร ไผ่ล้อมทำเล
          </span>
        </span>
      </p>
    </footer>
  );
}
