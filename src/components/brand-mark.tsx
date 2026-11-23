import React from "react";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  size?: number;
}

/**
 * Architectural geometric brand mark for BLUE CHECK-IN.
 * Flat obsidian & ice-periwinkle geometry (zero gradient tiles or AI sparkles).
 */
export function BrandMark({ className, size = 44 }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl border border-[var(--border-glass)] bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-sm",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
      >
        <path
          d="M6.5 16.8L12.6 22.8L25.5 9.8"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24.5" cy="23.5" r="2.1" fill="currentColor" fillOpacity="0.48" />
      </svg>
    </span>
  );
}
