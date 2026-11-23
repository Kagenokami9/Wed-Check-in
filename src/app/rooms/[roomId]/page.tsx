"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowClockwise, ArrowLeft, Info, Warning, WarningCircle, X } from "@phosphor-icons/react";
import { AppShell, useNavigationGuard } from "@/components/layout/app-shell";
import { RoomStickyHeader } from "@/components/room/room-sticky-header";
import { StatusSummaryBar } from "@/components/room/status-summary-bar";
import { StudentRow } from "@/components/room/student-row";
import { NicknameModal } from "@/components/room/nickname-modal";
import { SaveBar, UnsavedChangesDialog } from "@/components/room/save-bar";
import { DataErrorCard } from "@/components/shared/data-error-card";
import { useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import {
  computeAttendanceCounts,
  getDirtyEntryCount,
  matchesStudentQuery,
} from "@/lib/attendance-helpers";
import {
  ApiClientError,
  AttendanceConflictError,
  attendanceRepository,
} from "@/lib/repositories";
import { formatThaiTime, getTodayDateKey, isValidDateKey } from "@/lib/utils";
import type {
  AttendanceConflictInfo,
  AttendanceEntry,
  AttendanceFilter,
  AttendanceStatus,
  Room,
  RoomDailyAttendance,
  Student,
} from "@/types/attendance";

const NICKNAME_TIP_DISMISSED_KEY = "blue-checkin:nickname-tip-dismissed:v1";

function RoomAttendanceContent() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const { showToast } = useToast();

  const roomId = typeof params.roomId === "string" ? params.roomId : "";
  const queryDate = searchParams.get("date");
  const initialDate = isValidDateKey(queryDate) ? queryDate : getTodayDateKey();

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [room, setRoom] = useState<Room | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [savedRecord, setSavedRecord] = useState<RoomDailyAttendance | null>(null);
  const [draftEntries, setDraftEntries] = useState<Record<string, AttendanceEntry>>({});
  const [checkedDateKeys, setCheckedDateKeys] = useState<string[]>([]);

  const [activeFilter, setActiveFilter] = useState<AttendanceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; status?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showNicknameTip, setShowNicknameTip] = useState(false);

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [conflictInfo, setConflictInfo] = useState<AttendanceConflictInfo | null>(null);

  useEffect(() => {
    try {
      setShowNicknameTip(window.localStorage.getItem(NICKNAME_TIP_DISMISSED_KEY) !== "1");
    } catch {
      setShowNicknameTip(true);
    }
  }, []);

  const dismissNicknameTip = () => {
    setShowNicknameTip(false);
    try {
      window.localStorage.setItem(NICKNAME_TIP_DISMISSED_KEY, "1");
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (isValidDateKey(queryDate) && queryDate !== selectedDate) {
      setSelectedDate(queryDate);
    }
  }, [queryDate, selectedDate]);

  const loadRoomState = useCallback(
    async (targetRoomId: string, targetDate: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        const [detail, loadedAttendance] = await Promise.all([
          attendanceRepository.getRoomDetail(targetRoomId),
          attendanceRepository.getRoomAttendance(targetRoomId, targetDate),
        ]);

        if (!detail.room) {
          setNotFound(true);
          setRoom(null);
          return;
        }

        setNotFound(false);
        setRoom(detail.room);
        setStudents(detail.students);
        setCheckedDateKeys(detail.checkedDates);
        setSavedRecord(loadedAttendance);
        setDraftEntries(loadedAttendance?.entries ? { ...loadedAttendance.entries } : {});
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          router.replace("/login");
          return;
        }
        setLoadError({
          message:
            error instanceof Error
              ? error.message
              : "เกิดข้อผิดพลาดในการโหลดข้อมูลห้องเรียน",
          status: error instanceof ApiClientError ? error.status : undefined,
        });
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (roomId) {
      loadRoomState(roomId, selectedDate);
    }
  }, [roomId, selectedDate, loadRoomState]);

  const savedEntries = useMemo(() => savedRecord?.entries ?? {}, [savedRecord]);

  const counts = useMemo(
    () => computeAttendanceCounts(students, draftEntries),
    [students, draftEntries]
  );

  const dirtyCount = useMemo(
    () => getDirtyEntryCount(students, savedEntries, draftEntries),
    [students, savedEntries, draftEntries]
  );

  useEffect(() => {
    if (dirtyCount === 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyCount]);

  const guardNavigation = useCallback(
    (nextAction: () => void) => {
      if (dirtyCount > 0) {
        setPendingAction(() => nextAction);
        return true;
      }
      return false;
    },
    [dirtyCount]
  );

  useNavigationGuard(dirtyCount > 0 ? guardNavigation : null);

  const runGuarded = useCallback(
    (action: () => void) => {
      if (dirtyCount > 0) {
        setPendingAction(() => action);
        return;
      }
      action();
    },
    [dirtyCount]
  );

  const handleSelectDate = useCallback(
    (nextDate: string) => {
      if (nextDate === selectedDate) return;
      runGuarded(() => {
        setSelectedDate(nextDate);
        setActiveFilter("all");
        const nextUrl =
          nextDate === getTodayDateKey()
            ? `/rooms/${roomId}`
            : `/rooms/${roomId}?date=${nextDate}`;
        router.replace(nextUrl, { scroll: false });
      });
    },
    [roomId, router, runGuarded, selectedDate]
  );

  const handleBack = useCallback(() => {
    runGuarded(() => {
      router.push("/");
    });
  }, [router, runGuarded]);

  const handleSelectStatus = useCallback((studentId: string, status: AttendanceStatus) => {
    setDraftEntries((prev) => {
      const existing = prev[studentId];
      if (existing?.status === status) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return {
        ...prev,
        [studentId]: {
          studentId,
          status,
          ...(status === "other" && existing?.note ? { note: existing.note } : {}),
        },
      };
    });
  }, []);

  const handleChangeNote = useCallback((studentId: string, note: string) => {
    setDraftEntries((prev) => {
      const existing = prev[studentId];
      if (!existing) return prev;
      return {
        ...prev,
        [studentId]: {
          ...existing,
          note,
        },
      };
    });
  }, []);

  const handleMarkRemainingPresent = useCallback(() => {
    setDraftEntries((prev) => {
      const next = { ...prev };
      let added = 0;
      for (const student of students) {
        if (!next[student.id]) {
          next[student.id] = { studentId: student.id, status: "present" };
          added += 1;
        }
      }
      if (added > 0) {
        showToast(`เช็ค "มา" ให้ที่เหลือแล้ว ${added} คน (อย่าลืมกดบันทึก)`, "info");
      }
      return next;
    });
  }, [students, showToast]);

  const handleResetRoom = useCallback(() => {
    setDraftEntries({});
    showToast("ล้างสถานะในหน้าจอแล้ว (กดบันทึกเพื่อยืนยัน)", "info");
  }, [showToast]);

  const performSave = useCallback(
    async (forceOverwrite: boolean): Promise<boolean> => {
      if (!room) return false;
      setIsSaving(true);
      try {
        const entryCount = Object.keys(draftEntries).length;
        if (entryCount === 0) {
          if (!savedRecord) {
            showToast("กรุณาเลือกสถานะนักเรียนอย่างน้อย 1 คนก่อนบันทึก", "info");
            return false;
          }
          if (session?.role !== "admin") {
            showToast(
              "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบประวัติการเช็คชื่อทั้งวันได้",
              "error"
            );
            return false;
          }
          await attendanceRepository.deleteRoomAttendance(room.id, selectedDate);
          setSavedRecord(null);
          setCheckedDateKeys((prev) => prev.filter((d) => d !== selectedDate));
          showToast(
            `ลบประวัติเช็คชื่อห้อง ${room.name} เรียบร้อยแล้ว (กู้คืนได้จากหน้า Admin)`,
            "info"
          );
          return true;
        }

        const saved = await attendanceRepository.saveRoomAttendance({
          roomId: room.id,
          date: selectedDate,
          entries: draftEntries,
          checkedBy: session?.staffName ?? "สตาฟสีฟ้า",
          expectedVersion: savedRecord?.version ?? null,
          force: forceOverwrite,
        });
        setSavedRecord(saved);
        setDraftEntries({ ...saved.entries });
        setCheckedDateKeys((prev) =>
          prev.includes(selectedDate)
            ? prev
            : [selectedDate, ...prev].sort((a, b) => b.localeCompare(a))
        );
        showToast(
          forceOverwrite
            ? `บันทึกทับการเช็คชื่อห้อง ${room.name} เรียบร้อยแล้ว`
            : `บันทึกการเช็คชื่อห้อง ${room.name} เรียบร้อยแล้ว`,
          "success"
        );
        return true;
      } catch (error) {
        if (error instanceof AttendanceConflictError) {
          setConflictInfo(error.conflict);
          return false;
        }
        if (error instanceof ApiClientError && error.status === 401) {
          showToast("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง", "error");
          router.replace("/login");
          return false;
        }
        showToast(
          error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
          "error"
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [draftEntries, room, router, savedRecord, selectedDate, session?.role, session?.staffName, showToast]
  );

  const handleSave = useCallback(() => performSave(false), [performSave]);

  const handleOpenNicknameModal = useCallback((student: Student) => {
    setEditingStudent(student);
    setNicknameModalOpen(true);
  }, []);

  const handleSaveNickname = useCallback(
    async (studentId: string, nickname: string) => {
      try {
        await attendanceRepository.updateStudentNickname(studentId, nickname);
        setStudents((prev) =>
          prev.map((student) =>
            student.id === studentId
              ? { ...student, nickname: nickname || undefined }
              : student
          )
        );
        showToast(
          nickname ? `บันทึกชื่อเล่น |${nickname}| แล้ว` : "ล้างชื่อเล่นเรียบร้อยแล้ว",
          "success"
        );
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          router.replace("/login");
          return;
        }
        showToast(
          error instanceof Error ? error.message : "ไม่สามารถบันทึกชื่อเล่นได้",
          "error"
        );
        throw error;
      }
    },
    [router, showToast]
  );

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const entry = draftEntries[student.id];
      if (activeFilter !== "all") {
        if (activeFilter === "unmarked") {
          if (entry) return false;
        } else if (entry?.status !== activeFilter) {
          return false;
        }
      }
      return matchesStudentQuery(student, searchQuery);
    });
  }, [students, draftEntries, activeFilter, searchQuery]);

  if (loading && !room) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-16 sm:px-6 lg:pt-8">
        <div className="space-y-4">
          <div className="liquid-glass-panel mx-auto h-28 max-w-md animate-pulse rounded-3xl" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="liquid-glass-panel h-20 animate-pulse rounded-2xl" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="liquid-glass-panel h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-16 sm:px-6 lg:pt-12">
        <DataErrorCard
          message={loadError.message}
          status={loadError.status}
          onRetry={() => loadRoomState(roomId, selectedDate)}
          backHref="/"
        />
      </main>
    );
  }

  if (notFound || !room) {
    return (
      <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <div className="liquid-glass-panel w-full rounded-3xl p-8">
          <WarningCircle
            size={40}
            weight="regular"
            className="mx-auto text-[var(--status-absent-border)]"
            aria-hidden="true"
          />
          <h1 className="mt-3 text-xl font-bold text-[var(--text-primary)]">
            ไม่พบข้อมูลห้องเรียนนี้
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            ห้องเรียนอาจถูกปรับเปลี่ยนในรายชื่อล่าสุด กรุณากลับไปเลือกห้องจากหน้าโฮม
          </p>
          <Button asChild className="mt-5">
            <Link href="/">
              <ArrowLeft size={16} weight="bold" aria-hidden="true" />
              <span>กลับหน้าโฮม</span>
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 pb-10 sm:px-6 lg:px-8">
        <RoomStickyHeader
          room={room}
          selectedDate={selectedDate}
          checkedDateKeys={checkedDateKeys}
          counts={counts}
          savedBy={savedRecord?.checkedBy}
          savedAt={savedRecord?.updatedAt}
          onBack={handleBack}
          onSelectDate={handleSelectDate}
        />

        <StatusSummaryBar
          counts={counts}
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          onFilterChange={setActiveFilter}
          onSearchChange={setSearchQuery}
          onMarkRemainingPresent={handleMarkRemainingPresent}
          onResetRoom={handleResetRoom}
        />

        {showNicknameTip && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-2 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-2">
              <Info
                size={15}
                weight="regular"
                className="shrink-0 text-[var(--accent-ink)]"
                aria-hidden="true"
              />
              <span>กดค้างที่ชื่อนักเรียน หรือกดไอคอนดินสอด้านขวาเพื่อเพิ่มชื่อเล่น</span>
            </span>
            <button
              type="button"
              onClick={dismissNicknameTip}
              aria-label="ซ่อนคำแนะนำนี้"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X size={14} weight="bold" aria-hidden="true" />
            </button>
          </div>
        )}

        <section aria-label={`รายชื่อนักเรียนห้อง ${room.name}`} className="mt-3 space-y-2">
          {filteredStudents.length === 0 ? (
            <div className="liquid-glass-panel rounded-2xl px-6 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                ไม่พบนักเรียนตามตัวกรองที่เลือก
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("all");
                  setSearchQuery("");
                }}
                className="mt-2 text-xs font-semibold text-[var(--accent-ink)] hover:underline cursor-pointer"
              >
                แสดงนักเรียนทั้งหมด ({students.length} คน)
              </button>
            </div>
          ) : (
            filteredStudents.map((student) => (
              <StudentRow
                key={student.id}
                student={student}
                entry={draftEntries[student.id]}
                onSelectStatus={handleSelectStatus}
                onChangeNote={handleChangeNote}
                onOpenNicknameModal={handleOpenNicknameModal}
              />
            ))
          )}
        </section>
      </main>

      <SaveBar
        dirtyCount={dirtyCount}
        checkedCount={counts.checkedCount}
        totalCount={counts.total}
        hasSavedRecord={Boolean(savedRecord)}
        isSaving={isSaving}
        onSave={handleSave}
      />

      <NicknameModal
        student={editingStudent}
        open={nicknameModalOpen}
        onOpenChange={setNicknameModalOpen}
        onSaveNickname={handleSaveNickname}
      />

      <UnsavedChangesDialog
        open={Boolean(pendingAction)}
        dirtyCount={dirtyCount}
        onCancel={() => setPendingAction(null)}
        onDiscard={() => {
          const action = pendingAction;
          setPendingAction(null);
          action?.();
        }}
        onSaveAndContinue={async () => {
          const action = pendingAction;
          const ok = await handleSave();
          if (ok) {
            setPendingAction(null);
            action?.();
          }
        }}
      />

      {/* Optimistic Concurrency Conflict Resolution Dialog */}
      <Dialog
        open={Boolean(conflictInfo)}
        onOpenChange={(nextOpen) => !nextOpen && setConflictInfo(null)}
      >
        <DialogContent closeLabel="ปิดหน้าต่างแจ้งเตือน">
          <DialogHeader className="px-2">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--status-late-bg)] text-[var(--status-late-text)]">
              <Warning size={24} weight="fill" aria-hidden="true" />
            </div>
            <DialogTitle>ข้อมูลห้องนี้เพิ่งถูกบันทึกโดยผู้อื่น</DialogTitle>
            <DialogDescription>
              {conflictInfo && (
                <>
                  สตาฟ{" "}
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {conflictInfo.currentCheckedBy}
                  </strong>{" "}
                  เพิ่งบันทึกห้อง {room.name} เมื่อเวลา{" "}
                  <span className="tabular-nums">
                    {formatThaiTime(conflictInfo.currentUpdatedAt)}
                  </span>{" "}
                  (เวอร์ชัน {conflictInfo.currentVersion}) กรุณาเลือกว่าจะโหลดข้อมูลล่าสุดหรือยืนยันบันทึกทับ
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-6 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConflictInfo(null);
                loadRoomState(room.id, selectedDate);
              }}
            >
              <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
              <span>โหลดข้อมูลล่าสุด</span>
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={async () => {
                setConflictInfo(null);
                await performSave(true);
              }}
            >
              <span>ยืนยันบันทึกทับ</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function RoomPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="mx-auto max-w-4xl px-4 pb-28 pt-16 sm:px-6 lg:pt-8">
            <div className="liquid-glass-panel h-36 animate-pulse rounded-3xl" />
          </div>
        }
      >
        <RoomAttendanceContent />
      </Suspense>
    </AppShell>
  );
}
