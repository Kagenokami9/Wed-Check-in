"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowClockwise, LockSimple, ShieldCheck } from "@phosphor-icons/react";
import { DataErrorCard } from "@/components/shared/data-error-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatThaiTime } from "@/lib/utils";
import type { AuditLogItem } from "@/types/attendance";

const ACTION_LABELS: Record<string, string> = {
  auth_login: "เข้าสู่ระบบสำเร็จ",
  auth_failed: "กรอก PIN ไม่ถูกต้อง",
  auth_locked: "ถูกล็อกชั่วคราว (Brute-Force)",
  auth_logout: "ออกจากระบบ",
  attendance_saved: "บันทึกการเช็คชื่อ",
  attendance_force_saved: "บันทึกทับการเช็คชื่อ (Force)",
  attendance_deleted: "ลบประวัติการเช็คชื่อ",
  nickname_updated: "แก้ไขชื่อเล่นนักเรียน",
  room_created: "สร้างห้องเรียน",
  room_restored_and_updated: "กู้คืนและอัปเดตห้องเรียน",
  room_updated: "แก้ไขห้องเรียน",
  room_deleted: "ลบห้องเรียน",
  student_created: "เพิ่มนักเรียน",
  student_updated: "แก้ไขนักเรียน",
  student_deleted: "ลบนักเรียน",
  staff_pin_changed: "เปลี่ยน Member PIN",
  admin_pin_changed: "เปลี่ยน Admin PIN",
  snapshot_created: "สร้าง Snapshot สำรองข้อมูล",
  backup_exported: "ส่งออกไฟล์ Signed Backup",
  room_restored: "กู้คืนห้องเรียน",
  student_restored: "กู้คืนนักเรียน",
  attendance_session_restored: "กู้คืนประวัติเช็คชื่อ",
  owner_recovery_failed: "Owner Recovery Key ไม่ถูกต้อง",
  owner_emergency_reset_failed: "รีเซ็ต PIN ฉุกเฉินไม่ผ่าน",
  owner_emergency_pin_reset: "รีเซ็ตรหัส PIN ฉุกเฉิน (Owner)",
  system_restored: "กู้คืนระบบทั้งหมด (Owner)",
  system_seeded: "นำเข้าฐานข้อมูลเริ่มต้น",
};

const FILTER_OPTIONS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "attendance_saved", label: "บันทึกเช็คชื่อ" },
  { key: "auth_login", label: "เข้าสู่ระบบ" },
  { key: "auth_failed", label: "PIN ผิด" },
  { key: "staff_pin_changed", label: "เปลี่ยน Member PIN" },
  { key: "admin_pin_changed", label: "เปลี่ยน Admin PIN" },
  { key: "system_restored", label: "กู้คืนระบบ" },
];

function formatDateTimeTh(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
  return `${day} · ${formatThaiTime(iso)}`;
}

export function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadLogs = useCallback(async (selectedAction: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams({ limit: "80" });
      if (selectedAction !== "all") qs.set("action", selectedAction);
      const res = await fetch(`/api/admin/audit-logs?${qs.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        logs?: AuditLogItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "ไม่สามารถโหลด Audit Log ได้");
      }
      setLogs(data.logs ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "โหลด Audit Log ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs(actionFilter);
  }, [actionFilter, loadLogs]);

  return (
    <div className="space-y-4">
      <div className="liquid-glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-ink)]">
            <LockSimple size={15} weight="fill" aria-hidden="true" />
            Append-Only Audit Log (ฐานข้อมูลล็อกห้ามลบ/แก้ไข)
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => loadLogs(actionFilter)}
        >
          <ArrowClockwise size={14} weight="bold" aria-hidden="true" />
          <span>รีเฟรช</span>
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setActionFilter(opt.key)}
            className={cn(
              "min-h-8 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer",
              actionFilter === opt.key
                ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="liquid-glass-panel h-20 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : loadError ? (
        <DataErrorCard message={loadError} onRetry={() => loadLogs(actionFilter)} />
      ) : logs.length === 0 ? (
        <div className="liquid-glass-panel rounded-2xl px-6 py-10 text-center">
          <ShieldCheck size={28} weight="regular" className="mx-auto text-[var(--text-muted)]" />
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            ยังไม่มีบันทึก Audit Log ตามตัวกรองที่เลือก
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {logs.map((log) => {
            const isWarning =
              log.action.includes("failed") || log.action.includes("deleted");
            const isCritical =
              log.action.includes("pin") ||
              log.action.includes("restored") ||
              log.action.includes("owner");

            return (
              <article
                key={log.id}
                className="liquid-glass-panel rounded-2xl p-4 text-xs sm:text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={isWarning ? "absent" : isCritical ? "late" : "default"}
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                      <Badge variant="muted">{log.actorRole}</Badge>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {log.actorName}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      เป้าหมาย: <span className="font-mono">{log.entityType}</span>
                      {log.entityId ? (
                        <>
                          {" "}
                          · <span className="font-mono">{log.entityId}</span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                    #{log.id} · {formatDateTimeTh(log.createdAt)}
                  </span>
                </div>

                {(log.beforeData !== null || log.afterData !== null) && (
                  <details className="mt-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-medium text-[var(--text-secondary)]">
                      ดูรายละเอียดข้อมูลก่อน/หลัง
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--text-muted)]">
                      {JSON.stringify(
                        {
                          ...(log.beforeData !== null ? { before: log.beforeData } : {}),
                          ...(log.afterData !== null ? { after: log.afterData } : {}),
                        },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
