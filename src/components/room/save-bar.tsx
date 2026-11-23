"use client";

import React from "react";
import { CheckCircle, FloppyDisk, Warning } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SaveBarProps {
  dirtyCount: number;
  checkedCount: number;
  totalCount: number;
  hasSavedRecord: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export function SaveBar({
  dirtyCount,
  checkedCount,
  totalCount,
  hasSavedRecord,
  isSaving,
  onSave,
}: SaveBarProps) {
  const canSave = dirtyCount > 0 || (!hasSavedRecord && checkedCount > 0);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--sticky-save-bg)] backdrop-blur-xl lg:left-[78px]">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="min-w-0">
          {dirtyCount > 0 ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--status-late-text)] sm:text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--status-late-border)]" />
              <span className="truncate tabular-nums">
                มีแก้ไข {dirtyCount} รายการ (ยังไม่บันทึก)
              </span>
            </div>
          ) : hasSavedRecord ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--status-present-text)] sm:text-sm">
              <CheckCircle size={16} weight="fill" className="shrink-0" aria-hidden="true" />
              <span className="truncate tabular-nums">
                บันทึกแล้ว · {checkedCount}/{totalCount} คน
              </span>
            </div>
          ) : (
            <p className="truncate text-xs font-medium text-[var(--text-secondary)] sm:text-sm tabular-nums">
              เช็คแล้ว {checkedCount}/{totalCount} คน
            </p>
          )}
        </div>

        <Button
          type="button"
          size="lg"
          disabled={!canSave || isSaving}
          onClick={onSave}
          className="shrink-0 px-5 sm:px-6"
        >
          <FloppyDisk size={18} weight="regular" aria-hidden="true" />
          <span>{isSaving ? "กำลังบันทึก..." : "บันทึกการเช็คชื่อ"}</span>
        </Button>
      </div>
    </div>
  );
}

interface UnsavedChangesDialogProps {
  open: boolean;
  dirtyCount: number;
  onCancel: () => void;
  onDiscard: () => void;
  onSaveAndContinue: () => void;
}

export function UnsavedChangesDialog({
  open,
  dirtyCount,
  onCancel,
  onDiscard,
  onSaveAndContinue,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent closeLabel="อยู่หน้านี้ต่อ">
        <DialogHeader className="px-4">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--status-late-bg)] text-[var(--status-late-text)]">
            <Warning size={24} weight="fill" aria-hidden="true" />
          </div>
          <DialogTitle>ยังไม่ได้บันทึกการเช็คชื่อ</DialogTitle>
          <DialogDescription>
            มีการแก้ไขอยู่ {dirtyCount} รายการ หากออกจากหน้านี้หรือเปลี่ยนวันที่ตอนนี้ ข้อมูลที่ยังไม่ได้บันทึกจะหายไป
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-6 sm:justify-center">
          <Button type="button" variant="outline" onClick={onDiscard}>
            ไม่บันทึกและดำเนินการต่อ
          </Button>
          <Button type="button" onClick={onSaveAndContinue}>
            บันทึกก่อนดำเนินการต่อ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
