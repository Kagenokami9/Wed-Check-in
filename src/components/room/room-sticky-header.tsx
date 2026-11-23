"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Clock,
} from "@phosphor-icons/react";
import type { AttendanceCounts, Room } from "@/types/attendance";
import {
  cn,
  formatDateHeadingLabel,
  formatThaiDateShort,
  formatThaiTime,
  getTodayDateKey,
  parseDateKey,
  shiftDateKey,
  toDateKey,
} from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface RoomStickyHeaderProps {
  room: Room;
  selectedDate: string;
  checkedDateKeys: string[];
  counts: AttendanceCounts;
  savedBy?: string;
  savedAt?: string;
  onBack: () => void;
  onSelectDate: (nextDate: string) => void;
}

export function RoomStickyHeader({
  room,
  selectedDate,
  checkedDateKeys,
  counts,
  savedBy,
  savedAt,
  onBack,
  onSelectDate,
}: RoomStickyHeaderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const todayKey = getTodayDateKey();

  useEffect(() => {
    const onScroll = () => {
      setIsCollapsed(window.scrollY > 88);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const selectedDateObj = parseDateKey(selectedDate);
  const checkedDateObjs = checkedDateKeys.map(parseDateKey);
  const canGoNextDay = selectedDate < todayKey;

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const nextKey = toDateKey(date);
    setCalendarOpen(false);
    if (nextKey !== selectedDate) {
      onSelectDate(nextKey);
    }
  };

  return (
    <>
      {/* Sticky Top Control Bar (photo/j5rvMJJj.jpeg -> photo/5MjA6Lfp.jpeg) */}
      <header
        className={cn(
          "sticky top-0 z-30 -mx-4 px-4 py-3 transition-[background-color,border-color,box-shadow] duration-200 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
          isCollapsed
            ? "border-b border-[var(--border-subtle)] bg-[var(--sticky-header-bg)] backdrop-blur-xl shadow-xs"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 pl-14 lg:pl-0">
          {/* Left: Back button + Collapsed Compact Room Name */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              aria-label="กลับหน้าโฮม"
              className="liquid-glass-panel inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--text-primary)] transition-colors duration-150 hover:border-[var(--border-strong)] cursor-pointer"
            >
              <ArrowLeft size={19} weight="bold" aria-hidden="true" />
            </button>

            <div
              data-testid="room-collapsed-title"
              aria-hidden={!isCollapsed}
              className={cn(
                "min-w-0 transition-[transform,opacity] duration-200",
                isCollapsed
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              )}
            >
              <p className="truncate text-base font-bold leading-tight text-[var(--text-primary)] sm:text-lg">
                {room.name}
              </p>
              <p className="truncate text-[11px] font-medium text-[var(--text-secondary)] tabular-nums">
                <strong className="font-semibold text-[var(--text-primary)]">สรุป</strong>{" "}
                {counts.unmarked > 0
                  ? `ยังไม่เช็ค ${counts.unmarked}`
                  : `เช็คครบ ${counts.total}`}
              </p>
            </div>
          </div>

          {/* Right: Day stepper (< Date Picker >) inspired by photo/y-Vi1i7X.jpeg */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectDate(shiftDateKey(selectedDate, -1))}
              aria-label="วันก่อนหน้า"
              className={cn(
                "liquid-glass-panel h-11 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors duration-150 sm:w-10",
                isCollapsed ? "hidden sm:inline-flex" : "inline-flex"
              )}
            >
              <CaretLeft size={17} weight="bold" aria-hidden="true" />
            </button>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="เลือกวันที่เช็คชื่อ"
                  className="liquid-glass-panel inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)] cursor-pointer transition-colors duration-150 sm:gap-2 sm:px-3.5 sm:text-sm tabular-nums"
                >
                  <CalendarBlank
                    size={16}
                    weight="regular"
                    className="shrink-0 text-[var(--accent-ink)]"
                    aria-hidden="true"
                  />
                  <span className="sm:hidden">
                    {selectedDate === todayKey ? "วันนี้" : formatThaiDateShort(selectedDate)}
                  </span>
                  <span className="hidden sm:inline">
                    {formatDateHeadingLabel(selectedDate)}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-3">
                <Calendar
                  mode="single"
                  selected={selectedDateObj}
                  onSelect={handleCalendarSelect}
                  checkedDates={checkedDateObjs}
                  disabled={{ after: parseDateKey(todayKey) }}
                  defaultMonth={selectedDateObj}
                />
                <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5 text-[11px] text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-blue-strong)]" />
                    วันที่บันทึกแล้ว ({checkedDateKeys.length} วัน)
                  </span>
                  {selectedDate !== todayKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarOpen(false);
                        onSelectDate(todayKey);
                      }}
                      className="font-semibold text-[var(--accent-ink)] hover:underline cursor-pointer"
                    >
                      กลับวันนี้
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              disabled={!canGoNextDay}
              onClick={() => {
                if (canGoNextDay) {
                  onSelectDate(shiftDateKey(selectedDate, 1));
                }
              }}
              aria-label="วันถัดไป"
              className={cn(
                "liquid-glass-panel h-11 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40 cursor-pointer transition-colors duration-150 sm:w-10",
                isCollapsed ? "hidden sm:inline-flex" : "inline-flex"
              )}
            >
              <CaretRight size={17} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Compact Centered Room Title Hero (photo/j5rvMJJj.jpeg) — tight above-the-fold */}
      <section className="mx-auto max-w-4xl pb-4 pt-1 text-center">
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-[var(--text-primary)] sm:text-4xl">
          {room.name}
        </h1>

        <p className="mt-1 text-xs font-medium text-[var(--text-secondary)] sm:text-sm tabular-nums">
          {room.program} · {counts.total} คน
        </p>

        {room.homeroomTeachers && (
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            ครูประจำชั้น: {room.homeroomTeachers}
          </p>
        )}

        {savedBy && savedAt && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--status-present-border)]/35 bg-[var(--status-present-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-present-text)]">
            <Clock size={14} weight="regular" aria-hidden="true" />
            <span>
              บันทึกล่าสุดโดย {savedBy} · {formatThaiTime(savedAt)}
            </span>
          </div>
        )}
      </section>
    </>
  );
}
