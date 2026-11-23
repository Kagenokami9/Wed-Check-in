"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import { cn, formatThaiDateFull } from "@/lib/utils";
import type { StaffRole } from "@/types/attendance";

interface HeroHeaderProps {
  todayDateKey: string;
  checkedRoomsCount: number;
  totalRoomsCount: number;
  staffName: string;
  staffRole?: StaffRole;
}

function EightPointSparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className={className}>
      <path
        d="M18 3V33M3 18H33M7.4 7.4L28.6 28.6M28.6 7.4L7.4 28.6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HeroHeader({
  todayDateKey,
  checkedRoomsCount,
  totalRoomsCount,
  staffName,
  staffRole = "member",
}: HeroHeaderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsCollapsed(window.scrollY > 112);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const progressPercent =
    totalRoomsCount > 0 ? Math.round((checkedRoomsCount / totalRoomsCount) * 100) : 0;

  return (
    <>
      {/* Sticky Collapsing Top Bar (photo/bmJ6juQ9.jpeg) — clears mobile menu button cleanly */}
      <header
        aria-hidden={!isCollapsed}
        className={cn(
          "fixed inset-x-0 top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--sticky-header-bg)] backdrop-blur-xl transition-[transform,opacity] duration-200 lg:left-[78px]",
          isCollapsed
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-full opacity-0"
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 pl-[68px] sm:px-6 sm:pl-[72px] lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate font-display text-base font-medium tracking-[0.16em] text-[var(--text-primary)] uppercase sm:text-lg">
              BLUE CHECK-IN
            </span>
            <span className="hidden text-xs text-[var(--text-muted)] sm:inline">
              · สีฟ้าเช็คชื่อกันน
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] tabular-nums">
            <CheckCircle
              size={15}
              weight="fill"
              className="text-[var(--accent-ink)]"
              aria-hidden="true"
            />
            <span>
              วันนี้ {checkedRoomsCount}/{totalRoomsCount} ห้อง
            </span>
          </div>
        </div>
      </header>

      {/* Asymmetric Editorial Liquid Glass Hero (photo/utC2UIoZ.jpeg + photo/-eMEizZ2.jpeg) */}
      <section className="relative pt-16 lg:pt-8">
        <div className="liquid-glass-hero relative overflow-hidden rounded-3xl px-5 py-6 sm:px-8 sm:py-8">
          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            {/* Left Column: Clean Metadata Eyebrow + Display Title + Progress Track */}
            <div className="min-w-0 flex-1 text-left">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                {/* Subtle 3-dot motif from photo/utC2UIoZ.jpeg */}
                <span aria-hidden="true" className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-sky)]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)]/75" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-primary)]" />
                </span>
                <span>{formatThaiDateFull(todayDateKey)}</span>
                <span aria-hidden="true" className="text-[var(--text-muted)]">
                  ·
                </span>
                <span>
                  {staffRole === "admin" ? "ผู้ดูแล:" : "สตาฟ:"}{" "}
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {staffName}
                  </strong>
                </span>
                {staffRole === "admin" ? (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--accent-blue-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-blue-strong)] hover:text-[var(--text-on-accent)]"
                  >
                    <ShieldCheck size={13} weight="fill" aria-hidden="true" />
                    <span>Admin · จัดการระบบ</span>
                  </Link>
                ) : (
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Member
                  </span>
                )}
              </div>

              <h1 className="mt-3 font-display text-3xl font-medium tracking-[0.16em] text-[var(--text-primary)] uppercase sm:text-4xl lg:text-[44px] lg:leading-[1.08] lg:tracking-[0.2em]">
                BLUE CHECK-IN
              </h1>

              <p className="mt-2 text-sm font-medium text-[var(--text-secondary)] sm:text-base">
                สีฟ้าเช็คชื่อกันน
              </p>

              {/* Compact Today Progress Track (replaces stacked pills) */}
              <div className="mt-5 max-w-sm">
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="font-medium text-[var(--text-secondary)]">
                    เช็คชื่อวันนี้แล้ว {checkedRoomsCount} / {totalRoomsCount} ห้อง
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {progressPercent}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="ความคืบหน้าการเช็คชื่อวันนี้"
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--accent-blue-strong)] transition-[width] duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Clean Translucent Orb Composition inspired by photo/utC2UIoZ.jpeg */}
            <div
              aria-hidden="true"
              className="pointer-events-none relative hidden h-36 w-52 shrink-0 md:block lg:w-60"
            >
              <div
                className="absolute bottom-1 left-6 h-28 w-28 rounded-full opacity-85"
                style={{
                  background:
                    "radial-gradient(circle at 34% 30%, var(--accent-sky), var(--orb-solid) 82%)",
                }}
              />
              <div
                className="absolute right-4 top-0 h-28 w-28 rounded-full opacity-80 blur-xl"
                style={{
                  background:
                    "radial-gradient(circle at 45% 45%, rgba(255,255,255,0.75), var(--orb-primary) 72%)",
                }}
              />
              <EightPointSparkle className="absolute left-2 top-3 h-5 w-5 text-[var(--sparkle-color)]/80" />
              <EightPointSparkle className="absolute right-10 top-6 h-4 w-4 text-[var(--sparkle-color)]/70" />
              <EightPointSparkle className="absolute bottom-2 right-3 h-6 w-6 text-[var(--sparkle-color)]/80" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
