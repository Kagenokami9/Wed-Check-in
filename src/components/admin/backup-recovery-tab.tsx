"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowCounterClockwise,
  Database,
  DownloadSimple,
  FileArrowUp,
  Plus,
  ShieldWarning,
  Trash,
} from "@phosphor-icons/react";
import { DataErrorCard } from "@/components/shared/data-error-card";
import { useToast } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatThaiTime } from "@/lib/utils";
import type { SnapshotSummaryItem } from "@/types/attendance";

interface DeletedItem {
  id: string;
  label: string;
  deletedAt: string;
}

interface BackupsPayload {
  snapshots: SnapshotSummaryItem[];
  deletedItems: {
    rooms: DeletedItem[];
    students: DeletedItem[];
    sessions: DeletedItem[];
  };
}

const REASON_LABELS: Record<string, string> = {
  manual: "สร้างด้วยตนเอง",
  pre_delete: "ก่อนลบข้อมูล (อัตโนมัติ)",
  pre_restore: "ก่อนกู้คืนระบบ (อัตโนมัติ)",
  daily_auto: "สำรองรายวัน",
  initial: "เริ่มต้นระบบ",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })} · ${formatThaiTime(iso)}`;
}

export function BackupRecoveryTab() {
  const { showToast } = useToast();
  const [data, setData] = useState<BackupsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [restoringItemKey, setRestoringItemKey] = useState<string | null>(null);

  // Owner Full-System Recovery State
  const [recoverySource, setRecoverySource] = useState<"snapshot" | "upload">("snapshot");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedBundle, setUploadedBundle] = useState<unknown>(null);
  const [ownerRecoveryKey, setOwnerRecoveryKey] = useState("");
  const [ownerRestoring, setOwnerRestoring] = useState(false);

  const loadBackups = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/backups", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as Partial<BackupsPayload> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "ไม่สามารถโหลดรายการสำรองข้อมูลได้");
      }
      const nextPayload: BackupsPayload = {
        snapshots: json.snapshots ?? [],
        deletedItems: json.deletedItems ?? { rooms: [], students: [], sessions: [] },
      };
      setData(nextPayload);
      if (nextPayload.snapshots.length > 0) {
        setSelectedSnapshotId((prev) => prev || String(nextPayload.snapshots[0].id));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "โหลดข้อมูล Backup ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      const res = await fetch("/api/admin/backups", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as {
        snapshot?: SnapshotSummaryItem;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "สร้าง Snapshot ไม่สำเร็จ");
      }
      showToast(
        `สร้าง Snapshot #${json.snapshot?.id ?? ""} เรียบร้อยแล้ว`,
        "success"
      );
      await loadBackups();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "สร้าง Snapshot ไม่สำเร็จ", "error");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleRestoreSingleItem = async (
    entityType: "room" | "student" | "attendance_session",
    item: DeletedItem
  ) => {
    const key = `${entityType}:${item.id}`;
    setRestoringItemKey(key);
    try {
      const res = await fetch("/api/admin/restore/item", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId: item.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "กู้คืนรายการไม่สำเร็จ");
      }
      showToast(`กู้คืน "${item.label}" เรียบร้อยแล้ว`, "success");
      await loadBackups();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "กู้คืนไม่สำเร็จ", "error");
    } finally {
      setRestoringItemKey(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadedFileName("");
      setUploadedBundle(null);
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      setUploadedFileName(file.name);
      setUploadedBundle(parsed);
      showToast(`อ่านไฟล์ ${file.name} แล้ว พร้อมยืนยันกู้คืน`, "info");
    } catch {
      setUploadedFileName("");
      setUploadedBundle(null);
      showToast("ไฟล์ที่เลือกไม่ใช่ JSON ที่ถูกต้อง", "error");
    }
  };

  const handleOwnerRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerRecoveryKey.trim().length < 6) {
      showToast("กรุณากรอก Owner Recovery Key ให้ครบถ้วน", "error");
      return;
    }
    if (recoverySource === "snapshot" && !selectedSnapshotId) {
      showToast("กรุณาเลือก Snapshot ที่ต้องการกู้คืน", "error");
      return;
    }
    if (recoverySource === "upload" && !uploadedBundle) {
      showToast("กรุณาอัปโหลดไฟล์ Signed Backup (.json)", "error");
      return;
    }

    setOwnerRestoring(true);
    try {
      const body =
        recoverySource === "snapshot"
          ? {
              ownerRecoveryKey: ownerRecoveryKey.trim(),
              snapshotId: Number(selectedSnapshotId),
            }
          : {
              ownerRecoveryKey: ownerRecoveryKey.trim(),
              backupBundle: uploadedBundle,
            };

      const res = await fetch("/api/owner/recovery/restore", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        preRestoreSnapshotId?: number;
        restored?: Record<string, number>;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "กู้คืนระบบไม่สำเร็จ");
      }

      setOwnerRecoveryKey("");
      showToast(
        `กู้คืนระบบทั้งหมดสำเร็จ! (สำรองก่อนกู้คืนไว้ที่ Snapshot #${json.preRestoreSnapshotId ?? "-"})`,
        "success"
      );
      await loadBackups();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "กู้คืนระบบไม่สำเร็จ", "error");
    } finally {
      setOwnerRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="liquid-glass-panel h-40 animate-pulse rounded-3xl" />
        <div className="liquid-glass-panel h-48 animate-pulse rounded-3xl" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <DataErrorCard
        message={loadError ?? "ไม่สามารถโหลดข้อมูลสำรองได้"}
        onRetry={loadBackups}
      />
    );
  }

  const totalDeleted =
    data.deletedItems.rooms.length +
    data.deletedItems.students.length +
    data.deletedItems.sessions.length;

  return (
    <div className="space-y-6">
      {/* Layer 2 & 3: Snapshots + Off-site Signed Export */}
      <section className="liquid-glass-panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)] sm:text-lg">
              <Database size={19} weight="regular" className="text-[var(--accent-ink)]" />
              Snapshot และสำรองข้อมูลนอกระบบ (Signed JSON)
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              ไฟล์ Backup ทุกรายการลงลายเซ็น HMAC-SHA256 ป้องกันการปลอมแปลง และสร้าง Snapshot อัตโนมัติก่อนลบข้อมูลสำคัญ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={creatingSnapshot}
              onClick={handleCreateSnapshot}
            >
              <Plus size={15} weight="bold" aria-hidden="true" />
              <span>{creatingSnapshot ? "กำลังสร้าง..." : "สร้าง Snapshot ทันที"}</span>
            </Button>
            <Button asChild size="sm">
              <a href="/api/admin/backups/export" download>
                <DownloadSimple size={15} weight="bold" aria-hidden="true" />
                <span>ดาวน์โหลด Signed JSON</span>
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {data.snapshots.length === 0 ? (
            <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
              ยังไม่มี Snapshot ในระบบ กด &ldquo;สร้าง Snapshot ทันที&rdquo; เพื่อบันทึกจุดสำรองแรก
            </p>
          ) : (
            data.snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex flex-col justify-between gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 sm:flex-row sm:items-center"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-[var(--text-primary)] tabular-nums">
                      Snapshot #{snap.id}
                    </span>
                    <Badge variant="default">
                      {REASON_LABELS[snap.reason] ?? snap.reason}
                    </Badge>
                    <span className="text-[var(--text-muted)] tabular-nums">
                      SHA256: {snap.checksumSha256.slice(0, 12)}…
                    </span>
                  </div>
                  <p className="text-[var(--text-secondary)] tabular-nums">
                    โดย {snap.createdBy} · {formatDateTime(snap.createdAt)} ·{" "}
                    {snap.counts.rooms} ห้อง · {snap.counts.students} นักเรียน ·{" "}
                    {snap.counts.sessions} รอบเช็คชื่อ
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRecoverySource("snapshot");
                    setSelectedSnapshotId(String(snap.id));
                    showToast(`เลือก Snapshot #${snap.id} สำหรับส่วนกู้คืนระบบแล้ว`, "info");
                  }}
                >
                  เลือกกู้คืนจุดนี้
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Layer 1: Soft-Delete Recycle Bin (Admin) */}
      <section className="liquid-glass-panel rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Trash size={18} weight="regular" className="text-[var(--accent-ink)]" aria-hidden="true" />
          <h2 className="text-base font-bold text-[var(--text-primary)] tabular-nums">
            กู้คืนรายการที่ถูกลบแบบ Soft Delete ({totalDeleted})
          </h2>
        </div>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Admin สามารถกู้คืนห้องเรียน นักเรียน หรือรอบการเช็คชื่อที่เผลอลบกลับคืนได้ทันทีโดยไม่ต้องใช้ Owner Recovery Key
        </p>

        {totalDeleted === 0 ? (
          <p className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
            ไม่มีรายการที่ถูกลบในถังพักข้อมูล
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {(
              [
                { title: "ห้องเรียน", type: "room", items: data.deletedItems.rooms },
                { title: "นักเรียน", type: "student", items: data.deletedItems.students },
                {
                  title: "รอบการเช็คชื่อ",
                  type: "attendance_session",
                  items: data.deletedItems.sessions,
                },
              ] as const
            ).map(
              (group) =>
                group.items.length > 0 && (
                  <div key={group.type} className="space-y-2">
                    <h3 className="text-xs font-semibold text-[var(--text-muted)]">
                      {group.title} ({group.items.length})
                    </h3>
                    <div className="space-y-1.5">
                      {group.items.map((item) => {
                        const busy = restoringItemKey === `${group.type}:${item.id}`;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3.5 py-2.5 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[var(--text-primary)]">
                                {item.label}
                              </p>
                              <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                                ลบเมื่อ {formatDateTime(item.deletedAt)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => handleRestoreSingleItem(group.type, item)}
                            >
                              <ArrowCounterClockwise size={14} weight="bold" aria-hidden="true" />
                              <span>{busy ? "กำลังกู้คืน..." : "กู้คืน"}</span>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
            )}
          </div>
        )}
      </section>

      {/* Layer 3: Owner Full-System Recovery */}
      <section className="liquid-glass-panel rounded-3xl border-[var(--status-absent-border)]/40 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--status-absent-bg)] text-[var(--status-absent-text)]">
            <ShieldWarning size={22} weight="fill" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] sm:text-lg">
              กู้คืนข้อมูลทั้งระบบ (Owner Recovery Only)
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              การกู้คืนทั้งระบบจะย้อนข้อมูลห้อง นักเรียน และประวัติเช็คชื่อทั้งหมดแบบ Atomic Transaction (ระบบจะบันทึก{" "}
              <code>pre_restore</code> Snapshot ให้อัตโนมัติก่อนทุกครั้ง) และต้องยืนยันด้วย{" "}
              <strong>OWNER_RECOVERY_KEY</strong> เท่านั้น
            </p>
          </div>
        </div>

        <form onSubmit={handleOwnerRestore} className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRecoverySource("snapshot")}
              className={cn(
                "min-h-9 rounded-xl border px-3.5 text-xs font-semibold transition-colors cursor-pointer",
                recoverySource === "snapshot"
                  ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)]"
              )}
            >
              กู้คืนจาก Snapshot ในฐานข้อมูล
            </button>
            <button
              type="button"
              onClick={() => setRecoverySource("upload")}
              className={cn(
                "min-h-9 rounded-xl border px-3.5 text-xs font-semibold transition-colors cursor-pointer",
                recoverySource === "upload"
                  ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)]"
              )}
            >
              อัปโหลดไฟล์ Signed Backup (.json)
            </button>
          </div>

          {recoverySource === "snapshot" ? (
            <div>
              <label
                htmlFor="restore-snapshot-select"
                className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                เลือก Snapshot ปลายทาง
              </label>
              <select
                id="restore-snapshot-select"
                value={selectedSnapshotId}
                onChange={(e) => setSelectedSnapshotId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3.5 text-sm text-[var(--text-primary)]"
              >
                {data.snapshots.length === 0 ? (
                  <option value="">ยังไม่มี Snapshot ในฐานข้อมูล</option>
                ) : (
                  data.snapshots.map((snap) => (
                    <option key={snap.id} value={snap.id}>
                      Snapshot #{snap.id} ({REASON_LABELS[snap.reason] ?? snap.reason}) ·{" "}
                      {formatDateTime(snap.createdAt)}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div>
              <label
                htmlFor="backup-json-upload"
                className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                เลือกไฟล์ Signed Backup (.json)
              </label>
              <label
                htmlFor="backup-json-upload"
                className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 py-3 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent-blue-strong)] hover:text-[var(--text-primary)]"
              >
                <FileArrowUp size={18} weight="regular" aria-hidden="true" />
                <span>
                  {uploadedFileName
                    ? `เลือกไฟล์แล้ว: ${uploadedFileName}`
                    : "คลิกเพื่อเลือกไฟล์ .json ที่ดาวน์โหลดจากระบบ"}
                </span>
                <input
                  id="backup-json-upload"
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>
          )}

          <div>
            <label
              htmlFor="owner-recovery-key-input"
              className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Owner Recovery Key (เก็บแยกเฉพาะเจ้าของระบบ)
            </label>
            <Input
              id="owner-recovery-key-input"
              type="password"
              autoComplete="off"
              value={ownerRecoveryKey}
              onChange={(e) => setOwnerRecoveryKey(e.target.value)}
              placeholder="กรอก Owner Recovery Key เพื่อยืนยันการกู้คืนทั้งระบบ"
              required
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              disabled={ownerRestoring}
            >
              <ArrowCounterClockwise size={17} weight="bold" aria-hidden="true" />
              <span>{ownerRestoring ? "กำลังกู้คืนระบบ..." : "ยืนยันกู้คืนข้อมูลทั้งระบบ"}</span>
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
