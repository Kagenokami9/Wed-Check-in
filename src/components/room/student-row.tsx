"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  NotePencil,
  PencilSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import type { AttendanceEntry, AttendanceStatus, Student } from "@/types/attendance";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface StudentRowProps {
  student: Student;
  entry?: AttendanceEntry;
  onSelectStatus: (studentId: string, status: AttendanceStatus) => void;
  onChangeNote: (studentId: string, note: string) => void;
  onOpenNicknameModal: (student: Student) => void;
}

const LONG_PRESS_DURATION_MS = 450;
const MOVE_CANCEL_THRESHOLD_PX = 8;

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  icon: typeof CheckCircle;
  activeClass: string;
}> = [
  {
    value: "present",
    label: "มา",
    icon: CheckCircle,
    activeClass:
      "border-[var(--status-present-border)] bg-[var(--status-present-bg)] text-[var(--status-present-text)] font-semibold",
  },
  {
    value: "absent",
    label: "ไม่มา",
    icon: XCircle,
    activeClass:
      "border-[var(--status-absent-border)] bg-[var(--status-absent-bg)] text-[var(--status-absent-text)] font-semibold",
  },
  {
    value: "late",
    label: "สาย",
    icon: Clock,
    activeClass:
      "border-[var(--status-late-border)] bg-[var(--status-late-bg)] text-[var(--status-late-text)] font-semibold",
  },
  {
    value: "other",
    label: "อื่นๆ",
    icon: NotePencil,
    activeClass:
      "border-[var(--status-other-border)] bg-[var(--status-other-bg)] text-[var(--status-other-text)] font-semibold",
  },
];

const LEFT_ACCENT_COLOR: Record<AttendanceStatus, string> = {
  present: "var(--status-present-border)",
  absent: "var(--status-absent-border)",
  late: "var(--status-late-border)",
  other: "var(--status-other-border)",
};

export function StudentRow({
  student,
  entry,
  onSelectStatus,
  onChangeNote,
  onOpenNicknameModal,
}: StudentRowProps) {
  const [isHoldingName, setIsHoldingName] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPointRef.current = null;
    setIsHoldingName(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startPointRef.current = { x: e.clientX, y: e.clientY };
    setIsHoldingName(true);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setIsHoldingName(false);
      onOpenNicknameModal(student);
    }, LONG_PRESS_DURATION_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startPointRef.current || timerRef.current === null) return;
    const dx = Math.abs(e.clientX - startPointRef.current.x);
    const dy = Math.abs(e.clientY - startPointRef.current.y);
    if (dx > MOVE_CANCEL_THRESHOLD_PX || dy > MOVE_CANCEL_THRESHOLD_PX) {
      clearLongPress();
    }
  };

  const currentStatus = entry?.status;
  const fullName = `${student.prefix}${student.firstName} ${student.lastName}`;

  return (
    <article
      className={cn(
        "liquid-glass-panel relative overflow-hidden rounded-2xl p-3 pl-4 transition-[background-color,border-color] duration-150 sm:p-3.5 sm:pl-4",
        isHoldingName && "border-[var(--accent-ink)] bg-[var(--accent-blue-soft)]/50",
        currentStatus === "absent" && "border-[var(--status-absent-border)]/35",
        currentStatus === "late" && "border-[var(--status-late-border)]/35",
        currentStatus === "other" && "border-[var(--status-other-border)]/35"
      )}
    >
      {/* Pre-attentive Left Status Accent Stripe for instant 0.3s roster scanning */}
      <span
        aria-hidden="true"
        className="absolute inset-y-2 left-1 w-1 rounded-full transition-colors duration-150"
        style={{
          backgroundColor: currentStatus
            ? LEFT_ACCENT_COLOR[currentStatus]
            : "transparent",
        }}
      />

      {/* Top Row: Seat | De-emphasized Prefix + Bold Name [|Nickname|] + Pencil Button */}
      <div className="flex items-center justify-between gap-2">
        <div
          role="group"
          aria-label={`เลขที่ ${student.seatNumber} ${fullName}${student.nickname ? ` ชื่อเล่น ${student.nickname}` : ""} — กดค้างเพื่อเพิ่มชื่อเล่น`}
          title="กดค้างเพื่อเพิ่มหรือแก้ไขชื่อเล่น"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={clearLongPress}
          onPointerLeave={clearLongPress}
          onPointerCancel={clearLongPress}
          onContextMenu={(e) => {
            e.preventDefault();
          }}
          className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-3 rounded-lg py-0.5"
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
            {student.seatNumber}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
              <span className="text-xs font-normal text-[var(--text-muted)]">
                {student.prefix}
              </span>
              <span className="text-[15px] font-semibold leading-snug text-[var(--text-primary)] sm:text-base">
                {student.firstName} {student.lastName}
              </span>

              {student.nickname && (
                <span className="nickname-pill inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold leading-none">
                  |{student.nickname}|
                </span>
              )}

              {student.rosterNote && (
                <span
                  title={student.rosterNote}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--status-late-border)]/40 bg-[var(--status-late-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-late-text)]"
                >
                  <WarningCircle size={12} weight="fill" aria-hidden="true" />
                  <span>ขาดเรียนนาน</span>
                </span>
              )}
            </div>

            <p className="mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
              รหัส {student.studentCode}
              {student.rosterNote ? ` · ${student.rosterNote}` : ""}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenNicknameModal(student)}
          aria-label={`เพิ่มหรือแก้ไขชื่อเล่นของ ${student.firstName} ${student.lastName}`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <PencilSimple size={16} weight="regular" aria-hidden="true" />
        </button>
      </div>

      {/* Bottom Row: 4 Touch-Friendly Attendance Status Buttons (>= 44px, nested rounded-xl) */}
      <div
        className="mt-2.5 grid grid-cols-4 gap-1.5 sm:gap-2"
        role="group"
        aria-label={`สถานะการมาเรียนของ ${student.firstName}`}
      >
        {STATUS_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = currentStatus === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelectStatus(student.id, option.value)}
              aria-pressed={isSelected}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border px-1.5 text-xs font-medium transition-[background-color,border-color,color,transform] duration-150 cursor-pointer active:scale-[0.97] sm:gap-1.5 sm:px-3 sm:text-sm",
                isSelected
                  ? option.activeClass
                  : "border-[var(--border-subtle)] bg-[var(--surface-elevated)]/80 text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon size={16} weight={isSelected ? "fill" : "regular"} aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Inline Note Input when "อื่นๆ" is selected */}
      {currentStatus === "other" && (
        <div className="mt-2">
          <Input
            type="text"
            value={entry?.note ?? ""}
            onChange={(e) => onChangeNote(student.id, e.target.value)}
            placeholder="ระบุหมายเหตุ เช่น ลาป่วย, ไปแข่งกีฬา, ช่วยงานครู"
            aria-label={`หมายเหตุของ ${student.firstName} ${student.lastName}`}
            className="min-h-10 rounded-xl border-[var(--status-other-border)]/45 bg-[var(--status-other-bg)]/30 text-sm"
          />
        </div>
      )}
    </article>
  );
}
