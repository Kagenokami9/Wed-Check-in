"use client";

import React from "react";
import {
  CheckCircle,
  ArrowCounterClockwise,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import type { AttendanceCounts, AttendanceFilter } from "@/types/attendance";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface StatusSummaryBarProps {
  counts: AttendanceCounts;
  activeFilter: AttendanceFilter;
  searchQuery: string;
  onFilterChange: (filter: AttendanceFilter) => void;
  onSearchChange: (value: string) => void;
  onMarkRemainingPresent: () => void;
  onResetRoom: () => void;
}

export function StatusSummaryBar({
  counts,
  activeFilter,
  searchQuery,
  onFilterChange,
  onSearchChange,
  onMarkRemainingPresent,
  onResetRoom,
}: StatusSummaryBarProps) {
  const tiles: Array<{
    key: Exclude<AttendanceFilter, "all">;
    label: string;
    value: number;
    numberColor: string;
    activeRing: string;
  }> = [
    {
      key: "present",
      label: "มา",
      value: counts.present,
      numberColor: "text-[var(--status-present-text)]",
      activeRing:
        "border-[var(--status-present-border)] bg-[var(--status-present-bg)] ring-1 ring-[var(--status-present-border)]/40",
    },
    {
      key: "late",
      label: "สาย",
      value: counts.late,
      numberColor: "text-[var(--status-late-text)]",
      activeRing:
        "border-[var(--status-late-border)] bg-[var(--status-late-bg)] ring-1 ring-[var(--status-late-border)]/40",
    },
    {
      key: "absent",
      label: "ไม่มา",
      value: counts.absent,
      numberColor: "text-[var(--status-absent-text)]",
      activeRing:
        "border-[var(--status-absent-border)] bg-[var(--status-absent-bg)] ring-1 ring-[var(--status-absent-border)]/40",
    },
    {
      key: "other",
      label: "อื่นๆ",
      value: counts.other,
      numberColor: "text-[var(--status-other-text)]",
      activeRing:
        "border-[var(--status-other-border)] bg-[var(--status-other-bg)] ring-1 ring-[var(--status-other-border)]/40",
    },
    {
      key: "unmarked",
      label: "ยังไม่เช็ค",
      value: counts.unmarked,
      numberColor: "text-[var(--status-unmarked-text)]",
      activeRing:
        "border-[var(--accent-ink)] bg-[var(--accent-blue-soft)] ring-1 ring-[var(--accent-ink)]/35",
    },
  ];

  const handleTileClick = (key: Exclude<AttendanceFilter, "all">) => {
    onFilterChange(activeFilter === key ? "all" : key);
  };

  return (
    <section aria-label="สรุปสถานะและเครื่องมือเช็คชื่อ" className="space-y-3">
      {/* Compact inline summary caption (merges redundant pill chrome) */}
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="flex items-center gap-2 tabular-nums">
          <span className="font-semibold text-[var(--text-primary)]">สรุป</span>
          <span className="text-[var(--text-secondary)]">
            {counts.unmarked > 0 ? (
              <>
                ยังไม่เช็ค{" "}
                <strong className="font-semibold text-[var(--text-primary)]">
                  {counts.unmarked}
                </strong>
              </>
            ) : (
              <span className="font-medium text-[var(--status-present-text)]">
                เช็คครบแล้ว {counts.total}/{counts.total} คน
              </span>
            )}
          </span>
        </div>

        {activeFilter !== "all" && (
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-blue-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-ink)] hover:opacity-85 cursor-pointer"
          >
            <span>แสดงทั้งหมด</span>
            <X size={12} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 5 Rounded Status Counter Cards (photo/gRGrr8M9.jpeg) */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3" role="group" aria-label="กรองตามสถานะ">
        {tiles.map((tile) => {
          const isSelected = activeFilter === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => handleTileClick(tile.key)}
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-[72px] flex-col items-center justify-center rounded-2xl border px-1.5 py-2 text-center transition-[background-color,border-color,transform] duration-150 cursor-pointer active:scale-[0.97] sm:min-h-20",
                isSelected
                  ? tile.activeRing
                  : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-xs hover:border-[var(--border-strong)]"
              )}
            >
              <span
                className={cn(
                  "text-xl font-bold leading-none tabular-nums sm:text-2xl",
                  tile.numberColor
                )}
              >
                {tile.value}
              </span>
              <span className="mt-1.5 text-[11px] font-medium text-[var(--text-secondary)] sm:text-xs">
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Quick Action Row: Search + Harmonious Soft-Emerald Glass CTA + Reset */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={17}
            weight="regular"
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาเลขที่ ชื่อ หรือชื่อเล่น"
            aria-label="ค้นหานักเรียนในห้อง"
            className="pl-10 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="ล้างคำค้นหา"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X size={14} weight="bold" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={counts.unmarked === 0}
            onClick={onMarkRemainingPresent}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--cta-present-border)] bg-[var(--cta-present-bg)] px-4 text-sm font-semibold text-[var(--cta-present-text)] transition-[background-color,border-color,opacity,transform] duration-150 hover:bg-[var(--cta-present-hover)] active:scale-[0.98] disabled:pointer-events-none disabled:border-[var(--border-subtle)] disabled:bg-[var(--surface-card)] disabled:text-[var(--text-muted)] cursor-pointer sm:flex-initial sm:px-5"
          >
            <CheckCircle size={18} weight="fill" aria-hidden="true" />
            <span>{counts.checkedCount === 0 ? "เช็คมาทั้งหมด" : "ที่เหลือมา"}</span>
          </button>

          <button
            type="button"
            disabled={counts.checkedCount === 0}
            onClick={onResetRoom}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 text-sm font-medium text-[var(--text-primary)] transition-[background-color,opacity,transform] duration-150 hover:bg-[var(--accent-blue-soft)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 cursor-pointer"
          >
            <ArrowCounterClockwise size={16} weight="regular" aria-hidden="true" />
            <span>รีเซ็ต</span>
          </button>
        </div>
      </div>
    </section>
  );
}
