"use client";

import React from "react";
import Link from "next/link";
import { ArrowClockwise, ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface DataErrorCardProps {
  title?: string;
  message: string;
  status?: number;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
}

export function DataErrorCard({
  title,
  message,
  status,
  onRetry,
  backHref,
  backLabel = "กลับหน้าโฮม",
}: DataErrorCardProps) {
  const isServiceUnavailable = status === 503;
  const resolvedTitle =
    title ??
    (isServiceUnavailable
      ? "ระบบฐานข้อมูลไม่พร้อมใช้งานชั่วคราว"
      : "ไม่สามารถโหลดข้อมูลจากเซิร์ฟเวอร์ได้");

  return (
    <section
      role="alert"
      className="liquid-glass-panel mx-auto mt-6 max-w-xl rounded-3xl px-6 py-10 text-center"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--status-absent-bg)] text-[var(--status-absent-text)]">
        <WarningCircle size={26} weight="fill" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-[var(--text-primary)]">{resolvedTitle}</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{message}</p>
      {isServiceUnavailable && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          ระบบทำงานแบบ Fail-Closed เพื่อป้องกันข้อมูลสูญหาย กรุณาตรวจสอบการตั้งค่า Supabase หรือลองใหม่อีกครั้ง
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {onRetry && (
          <Button type="button" onClick={onRetry}>
            <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
            <span>ลองใหม่อีกครั้ง</span>
          </Button>
        )}
        {backHref && (
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft size={16} weight="bold" aria-hidden="true" />
              <span>{backLabel}</span>
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
