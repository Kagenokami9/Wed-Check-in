"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle, Key, ShieldCheck, User, Warning } from "@phosphor-icons/react";
import { useToast } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatThaiTime } from "@/lib/utils";
import type { StaffRole } from "@/types/attendance";

interface PinStatusMeta {
  staffSessionVersion: number;
  adminSessionVersion: number;
  updatedAt: string;
  updatedBy: string;
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })} · ${formatThaiTime(iso)}`;
}

export function SecurityPinsTab() {
  const { showToast } = useToast();
  const [targetRole, setTargetRole] = useState<StaffRole>("member");
  const [currentAdminPin, setCurrentAdminPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [meta, setMeta] = useState<PinStatusMeta | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pins", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as PinStatusMeta;
      setMeta(data);
    } catch {
      // Non-critical metadata load
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(currentAdminPin)) {
      showToast("กรุณากรอกรหัส Admin PIN ปัจจุบันให้ครบ 6 หลัก", "error");
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      showToast("รหัส PIN ใหม่ต้องเป็นตัวเลข 6 หลักเท่านั้น", "error");
      return;
    }
    if (newPin !== confirmPin) {
      showToast("รหัส PIN ใหม่และการยืนยันไม่ตรงกัน", "error");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/pins", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole,
          currentAdminPin,
          newPin,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        staffSessionVersion?: number;
        adminSessionVersion?: number;
        updatedAt?: string;
        updatedBy?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "ไม่สามารถเปลี่ยนรหัส PIN ได้");
      }

      if (data.staffSessionVersion && data.adminSessionVersion && data.updatedAt && data.updatedBy) {
        setMeta({
          staffSessionVersion: data.staffSessionVersion,
          adminSessionVersion: data.adminSessionVersion,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        });
      }

      setCurrentAdminPin("");
      setNewPin("");
      setConfirmPin("");
      showToast(
        targetRole === "member"
          ? "เปลี่ยนรหัส Member PIN (สตาฟทั่วไป) สำเร็จ! ส่วน Admin PIN ยังคงเดิม"
          : "เปลี่ยนรหัส Admin PIN (ผู้ดูแลระบบ) สำเร็จ! ส่วน Member PIN ยังคงเดิม",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการเปลี่ยนรหัส PIN",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const targetLabel =
    targetRole === "member" ? "Member PIN (สตาฟทั่วไป)" : "Admin PIN (ผู้ดูแลระบบ)";
  const untouchedLabel =
    targetRole === "member" ? "Admin PIN (ผู้ดูแลระบบ)" : "Member PIN (สตาฟทั่วไป)";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="liquid-glass-panel rounded-3xl p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-blue-soft)] text-[var(--accent-ink)]">
            <Key size={22} weight="regular" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              เปลี่ยนรหัส PIN เข้าระบบ (2-Tier RBAC)
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              เลือกรหัสที่ต้องการเปลี่ยนด้านล่าง — รหัสทั้งหมดเก็บเป็น Salted scrypt Hash และแยกสิทธิ์ Member กับ Admin ออกจากกันเด็ดขาด
            </p>
            {meta && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                <Badge variant="default">Member PIN · รอบ v{meta.staffSessionVersion}</Badge>
                <Badge variant="default">Admin PIN · รอบ v{meta.adminSessionVersion}</Badge>
                <span className="text-[var(--text-muted)]">
                  อัปเดตล่าสุดโดย {meta.updatedBy} · {formatUpdatedAt(meta.updatedAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Step 1: Unmistakable Role Selector */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            ขั้นตอนที่ 1 · เลือกว่าต้องการเปลี่ยนรหัสของสิทธิ์ใด
          </p>
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="เลือกระดับสิทธิ์ที่ต้องการเปลี่ยนรหัส"
          >
            <button
              type="button"
              role="radio"
              aria-checked={targetRole === "member"}
              onClick={() => setTargetRole("member")}
              className={cn(
                "relative rounded-2xl border-2 p-4 text-left transition-colors cursor-pointer",
                targetRole === "member"
                  ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-soft)]/55 shadow-xs"
                  : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
                  <User size={16} weight={targetRole === "member" ? "fill" : "regular"} aria-hidden="true" />
                  Member PIN (สตาฟ)
                </span>
                {targetRole === "member" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-blue-strong)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-on-accent)]">
                    <CheckCircle size={12} weight="fill" aria-hidden="true" />
                    กำลังเลือก
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                ใช้สำหรับเช็คชื่อ เพิ่มชื่อเล่น ดูประวัติ และ Export CSV
              </p>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={targetRole === "admin"}
              onClick={() => setTargetRole("admin")}
              className={cn(
                "relative rounded-2xl border-2 p-4 text-left transition-colors cursor-pointer",
                targetRole === "admin"
                  ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-soft)]/55 shadow-xs"
                  : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
                  <ShieldCheck size={16} weight={targetRole === "admin" ? "fill" : "regular"} aria-hidden="true" />
                  Admin PIN (ผู้ดูแล)
                </span>
                {targetRole === "admin" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-blue-strong)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-on-accent)]">
                    <CheckCircle size={12} weight="fill" aria-hidden="true" />
                    กำลังเลือก
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                ใช้เข้าหน้า /admin จัดการห้อง/นักเรียน เปลี่ยน PIN และสำรองข้อมูล
              </p>
            </button>
          </div>
        </div>

        {/* Unmistakable Target Confirmation Banner */}
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[var(--status-late-border)]/45 bg-[var(--status-late-bg)]/65 p-3.5 text-xs text-[var(--status-late-text)]">
          <Warning size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">
              กำลังจะเปลี่ยนเฉพาะ: {targetLabel}
            </p>
            <p>
              รหัสของ <strong>{untouchedLabel}</strong> จะยังคงเดิมไม่ถูกเปลี่ยนแปลง
              และเซสชันเดิมทั้งหมดของ {targetLabel} จะถูกบังคับออกจากระบบทันที
              {targetRole === "admin" && " (ยกเว้นเบราว์เซอร์ที่คุณกำลังใช้งานอยู่)"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="current-admin-pin"
              className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]"
            >
              ขั้นตอนที่ 2 · ยืนยันตัวตนด้วย Admin PIN ปัจจุบัน (6 หลัก)
            </label>
            <p className="mb-1.5 text-[11px] text-[var(--text-muted)]">
              กรอกรหัสผู้ดูแลระบบปัจจุบันเสมอเพื่อยืนยันสิทธิ์การเปลี่ยนแปลง
            </p>
            <Input
              id="current-admin-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoComplete="current-password"
              value={currentAdminPin}
              onChange={(e) => setCurrentAdminPin(e.target.value.replace(/\D/g, ""))}
              placeholder="กรอก Admin PIN ปัจจุบัน 6 หลัก"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="new-pin"
                className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                ตั้งรหัส {targetLabel} ใหม่ (6 หลัก)
              </label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="new-password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="ตัวเลข 6 หลัก"
                required
              />
            </div>

            <div>
              <label
                htmlFor="confirm-pin"
                className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                ยืนยันรหัส {targetRole === "member" ? "Member PIN" : "Admin PIN"} ใหม่
              </label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="new-password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="กรอกซ้ำ 6 หลัก"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="lg" disabled={submitting}>
              <ShieldCheck size={18} weight="bold" aria-hidden="true" />
              <span>
                {submitting
                  ? "กำลังบันทึกรหัสใหม่..."
                  : `ยืนยันเปลี่ยน ${targetLabel}`}
              </span>
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
