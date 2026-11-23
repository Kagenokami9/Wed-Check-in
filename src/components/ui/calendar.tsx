"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { th } from "date-fns/locale";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps & {
  checkedDates?: Date[];
};

function Calendar({ className, classNames, checkedDates = [], ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={th}
      showOutsideDays
      modifiers={{
        checked: checkedDates,
        ...props.modifiers,
      }}
      modifiersClassNames={{
        checked:
          "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-[var(--accent-blue-strong)]",
        ...props.modifiersClassNames,
      }}
      className={cn("p-1 select-none", className)}
      classNames={{
        months: "flex flex-col gap-3",
        month: "flex flex-col gap-3",
        month_caption: "relative flex h-10 items-center justify-center",
        caption_label: "text-sm font-semibold text-[var(--text-primary)]",
        nav: "flex items-center justify-between absolute inset-x-0 top-0 h-10 pointer-events-none",
        button_previous:
          "pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)] cursor-pointer transition-colors",
        button_next:
          "pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)] cursor-pointer transition-colors",
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7 mb-1",
        weekday:
          "text-center text-[11px] font-medium text-[var(--text-muted)] h-8 flex items-center justify-center",
        week: "grid grid-cols-7 gap-y-1",
        day: "relative flex items-center justify-center p-0.5 text-center",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--accent-blue-soft)] cursor-pointer transition-colors tabular-nums",
        selected:
          "[&>button]:bg-[var(--accent-blue-strong)] [&>button]:text-[var(--text-on-accent)] [&>button]:font-semibold [&>button]:hover:bg-[var(--accent-blue-strong)]",
        today: "[&>button]:border [&>button]:border-[var(--accent-blue-strong)]",
        outside: "[&>button]:text-[var(--text-muted)] [&>button]:opacity-45",
        disabled: "[&>button]:opacity-30 [&>button]:pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <CaretLeft size={16} weight="bold" aria-hidden="true" />
          ) : (
            <CaretRight size={16} weight="bold" aria-hidden="true" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
