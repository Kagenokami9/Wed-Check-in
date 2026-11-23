"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChalkboardSimple, Check, ArrowUpRight, Users } from "@phosphor-icons/react";
import type { AttendanceCounts, Room } from "@/types/attendance";
import { cn } from "@/lib/utils";

interface RoomCardProps {
  room: Room;
  roomIndex: number;
  counts: AttendanceCounts;
  hasSavedToday: boolean;
}

const GRADE_ACCENT_VAR: Record<number, string> = {
  1: "var(--grade-1-accent)",
  2: "var(--grade-2-accent)",
  3: "var(--grade-3-accent)",
  4: "var(--grade-4-accent)",
};

export function RoomCard({ room, roomIndex, counts, hasSavedToday }: RoomCardProps) {
  const [isPressed, setIsPressed] = useState(false);

  const formattedNumber = String(roomIndex + 1).padStart(2, "0");
  const isCompleteToday = hasSavedToday && counts.unmarked === 0 && counts.total > 0;
  const gradeAccent = GRADE_ACCENT_VAR[room.grade] ?? "var(--accent-blue)";

  const total = Math.max(counts.total, 1);
  const presentPct = (counts.present / total) * 100;
  const latePct = (counts.late / total) * 100;
  const absentPct = (counts.absent / total) * 100;
  const otherPct = (counts.other / total) * 100;

  return (
    <div className="group relative pr-2 pt-2">
      <Link
        href={`/rooms/${room.id}`}
        data-pressed={isPressed ? "true" : undefined}
        onPointerDown={() => setIsPressed(true)}
        onPointerUp={() => setIsPressed(false)}
        onPointerLeave={() => setIsPressed(false)}
        onPointerCancel={() => setIsPressed(false)}
        className="liquid-glass-room flex h-full min-h-44 flex-col justify-between rounded-3xl p-5 text-left outline-none"
      >
        {/* Top Meta Label (inspired by photo/4ESP_xQO.jpeg) */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 pr-9">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase tabular-nums"
              style={{ color: gradeAccent }}
            >
              <ChalkboardSimple size={15} weight="regular" aria-hidden="true" />
              ROOM · {formattedNumber}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/75 px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: gradeAccent }}
              />
              ม.{room.grade}
            </span>
          </div>

          {/* Room Title with tight display tracking */}
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] sm:text-[26px]">
            {room.name}
          </h2>

          <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">
            {room.program || "ห้องเรียนคณะสีฟ้า"}
          </p>
        </div>

        {/* Bottom Attendance Strip + Segmented Micro Progress Bar */}
        <div className="relative z-10 mt-4 pt-3">
          {/* 3px Segmented Progress Track */}
          <div
            aria-hidden="true"
            className="mb-3 flex h-1 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]"
          >
            {hasSavedToday && (
              <>
                {presentPct > 0 && (
                  <span
                    className="h-full bg-[var(--status-present-border)]"
                    style={{ width: `${presentPct}%` }}
                  />
                )}
                {latePct > 0 && (
                  <span
                    className="h-full bg-[var(--status-late-border)]"
                    style={{ width: `${latePct}%` }}
                  />
                )}
                {absentPct > 0 && (
                  <span
                    className="h-full bg-[var(--status-absent-border)]"
                    style={{ width: `${absentPct}%` }}
                  />
                )}
                {otherPct > 0 && (
                  <span
                    className="h-full bg-[var(--status-other-border)]"
                    style={{ width: `${otherPct}%` }}
                  />
                )}
              </>
            )}
          </div>

          {hasSavedToday ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-semibold">
                <span className="text-[var(--status-present-text)]">มา {counts.present}</span>
                {counts.late > 0 && (
                  <span className="text-[var(--status-late-text)]">สาย {counts.late}</span>
                )}
                {counts.absent > 0 && (
                  <span className="text-[var(--status-absent-text)]">ไม่มา {counts.absent}</span>
                )}
                {counts.other > 0 && (
                  <span className="text-[var(--status-other-text)]">อื่นๆ {counts.other}</span>
                )}
                {counts.unmarked > 0 && (
                  <span className="text-[var(--text-muted)]">เหลือ {counts.unmarked}</span>
                )}
              </div>
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                {counts.total} คน
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: gradeAccent }}
                />
                ยังไม่เช็ควันนี้
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
                <Users size={14} weight="regular" aria-hidden="true" />
                {counts.total} คน
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Overlapping Circular Status Seal (signature detail from photo/4ESP_xQO.jpeg) */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border transition-transform duration-150 group-hover:scale-105",
          isCompleteToday
            ? "border-[var(--status-present-border)]/45 bg-[var(--room-badge-circle-bg)] text-[var(--status-present-text)]"
            : hasSavedToday
              ? "border-[var(--accent-ink)]/35 bg-[var(--room-badge-circle-bg)] text-[var(--accent-ink)]"
              : "border-[var(--border-glass)] bg-[var(--room-badge-circle-bg)] text-[var(--text-secondary)]"
        )}
        style={{ boxShadow: "var(--room-badge-circle-shadow)" }}
      >
        {hasSavedToday ? (
          <Check size={18} weight="bold" />
        ) : (
          <ArrowUpRight
            size={17}
            weight="bold"
            className="transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        )}
      </span>
    </div>
  );
}
