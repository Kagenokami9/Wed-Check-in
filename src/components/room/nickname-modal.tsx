"use client";

import React, { useEffect, useState } from "react";
import { Trash } from "@phosphor-icons/react";
import type { Student } from "@/types/attendance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface NicknameModalProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveNickname: (studentId: string, nickname: string) => Promise<void>;
}

export function NicknameModal({
  student,
  open,
  onOpenChange,
  onSaveNickname,
}: NicknameModalProps) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (student && open) {
      setValue(student.nickname ?? "");
    }
  }, [student, open]);

  if (!student) return null;

  const trimmed = value.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveNickname(student.id, trimmed);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await onSaveNickname(student.id, "");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel="ปิดหน้าต่างเพิ่มชื่อเล่น">
        {/* Centered Header + circular X button in top-right (from DialogContent) */}
        <DialogHeader className="px-6">
          <DialogTitle className="text-xl font-bold">เพิ่มชื่อเล่น</DialogTitle>
          <DialogDescription>
            เลขที่ {student.seatNumber} · {student.prefix}
            {student.firstName} {student.lastName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="nickname-input"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              ชื่อเล่นนักเรียน (ช่วยจำและค้นหาได้เร็วขึ้น)
            </label>
            <Input
              id="nickname-input"
              autoFocus
              maxLength={24}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="พิมพ์ชื่อเล่น เช่น บีม, น้ำหวาน, โอม..."
              className="text-base"
            />
          </div>

          {/* Live Preview */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm">
            <p className="text-[11px] text-[var(--text-muted)]">ตัวอย่างการแสดงผลในรายชื่อ</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-semibold text-[var(--text-primary)]">
              <span>
                {student.firstName} {student.lastName}
              </span>
              {trimmed && (
                <span className="nickname-pill inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold">
                  |{trimmed}|
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            {student.nickname && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={handleClear}
                className="text-[var(--status-absent-text)] hover:bg-[var(--status-absent-bg)] sm:mr-auto"
              >
                <Trash size={16} weight="duotone" aria-hidden="true" />
                <span>ล้างชื่อเล่น</span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              ยกเลิก
            </Button>

            <Button type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึกชื่อเล่น"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
