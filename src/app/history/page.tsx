"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarBlank,
  CaretDown,
  Check,
  ClockCounterClockwise,
  Funnel,
  House,
  MagnifyingGlass,
  Trash,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/layout/app-shell";
import { DataErrorCard } from "@/components/shared/data-error-card";
import { useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  matchesStudentQuery,
  STATUS_META,
} from "@/lib/attendance-helpers";
import {
  ApiClientError,
  attendanceRepository,
  DATA_CHANGED_EVENT,
} from "@/lib/repositories";
import { cn, formatThaiDateFull, formatThaiDateShort, formatThaiTime } from "@/lib/utils";
import type { Room, RoomDailyAttendance, Student } from "@/types/attendance";

export default function HistoryPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { showToast } = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<RoomDailyAttendance[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; status?: number } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RoomDailyAttendance | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadError(null);
    try {
      const [loadedRooms, loadedStudents, loadedRecords] = await Promise.all([
        attendanceRepository.getRooms(),
        attendanceRepository.getAllStudents(),
        attendanceRepository.getAllAttendance(),
      ]);
      setRooms(loadedRooms);
      setStudents(loadedStudents);
      setRecords(loadedRecords);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        router.replace("/login");
        return;
      }
      setLoadError({
        message:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการโหลดประวัติการเช็คชื่อ",
        status: error instanceof ApiClientError ? error.status : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadHistory();
    const onChange = () => loadHistory();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [loadHistory]);

  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const studentsByRoom = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const student of students) {
      const list = map.get(student.roomId) ?? [];
      list.push(student);
      map.set(student.roomId, list);
    }
    return map;
  }, [students]);

  const availableDates = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.date))).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return records.filter((record) => {
      if (selectedRoomId !== "all" && record.roomId !== selectedRoomId) return false;
      if (selectedDate !== "all" && record.date !== selectedDate) return false;
      if (!query) return true;

      const room = roomMap.get(record.roomId);
      const roomMatch =
        room?.name.toLowerCase().includes(query) ||
        room?.program.toLowerCase().includes(query);
      const staffMatch = record.checkedBy.toLowerCase().includes(query);
      const roomStudents = studentsByRoom.get(record.roomId) ?? [];
      const studentMatch = roomStudents.some((s) => matchesStudentQuery(s, query));

      return Boolean(roomMatch || staffMatch || studentMatch);
    });
  }, [records, selectedRoomId, selectedDate, searchQuery, roomMap, studentsByRoom]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, RoomDailyAttendance[]>();
    for (const record of filteredRecords) {
      const list = groups.get(record.date) ?? [];
      list.push(record);
      groups.set(record.date, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredRecords]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await attendanceRepository.deleteRoomAttendance(deleteTarget.roomId, deleteTarget.date);
      const roomName = roomMap.get(deleteTarget.roomId)?.name ?? deleteTarget.roomId;
      showToast(
        `ลบประวัติห้อง ${roomName} วันที่ ${formatThaiDateShort(deleteTarget.date)} แล้ว (กู้คืนได้จากหน้า Admin)`,
        "info"
      );
      setDeleteTarget(null);
      await loadHistory();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "ไม่สามารถลบประวัติการเช็คชื่อได้",
        "error"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedRoomLabel =
    selectedRoomId === "all"
      ? `ทุกห้องเรียน (${rooms.length})`
      : roomMap.get(selectedRoomId)?.name ?? selectedRoomId;

  const selectedDateLabel =
    selectedDate === "all"
      ? `ทุกวันที่ (${availableDates.length} วัน)`
      : formatThaiDateShort(selectedDate);

  const isAdmin = session?.role === "admin";

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pt-8">
        <header className="mb-6 pl-14 lg:pl-0">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            ประวัติ · สีฟ้าเช็คชื่อกันน
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] sm:text-3xl">
            ประวัติการเช็คชื่อ
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            ตรวจสอบรายการเช็คชื่อย้อนหลัง ค้นหาด้วยชื่อจริงหรือชื่อเล่น แล้วกดเข้าไปแก้ไขได้ทันที
          </p>
        </header>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="liquid-glass-panel h-28 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : loadError ? (
          <DataErrorCard
            message={loadError.message}
            status={loadError.status}
            onRetry={() => {
              setLoading(true);
              loadHistory();
            }}
          />
        ) : records.length === 0 ? (
          <section className="liquid-glass-hero mx-auto mt-8 max-w-lg rounded-3xl px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-blue-soft)] text-[var(--accent-ink)]">
              <ClockCounterClockwise size={28} weight="regular" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">
              ยังไม่มีประวัติการเช็คชื่อ
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              เมื่อสตาฟเช็คชื่อและกดบันทึกในแต่ละห้อง รายการย้อนหลังพร้อมชื่อผู้บันทึกจะแสดงที่หน้านี้อัตโนมัติ
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/">
                <House size={18} weight="regular" aria-hidden="true" />
                <span>ไปหน้าโฮมเพื่อเริ่มเช็คชื่อ</span>
              </Link>
            </Button>
          </section>
        ) : (
          <>
            <section
              aria-label="ตัวกรองประวัติการเช็คชื่อ"
              className="liquid-glass-panel rounded-2xl p-3.5"
            >
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
                <div className="relative md:col-span-5">
                  <MagnifyingGlass
                    size={16}
                    weight="regular"
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <Input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อ ชื่อเล่น ห้อง หรือผู้เช็คชื่อ"
                    aria-label="ค้นหาในประวัติเช็คชื่อ"
                    className="pl-10 pr-9"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="ล้างคำค้นหา"
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-blue-soft)] cursor-pointer"
                    >
                      <X size={14} weight="bold" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="md:col-span-4">
                  <Popover open={roomPopoverOpen} onOpenChange={setRoomPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="กรองตามห้องเรียน"
                        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3.5 text-sm font-medium text-[var(--text-primary)] transition-colors duration-150 hover:border-[var(--border-strong)] cursor-pointer"
                      >
                        <span className="truncate">{selectedRoomLabel}</span>
                        <CaretDown
                          size={15}
                          weight="bold"
                          className="shrink-0 text-[var(--text-muted)]"
                          aria-hidden="true"
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-1.5">
                      <div className="max-h-64 overflow-y-auto space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoomId("all");
                            setRoomPopoverOpen(false);
                          }}
                          className={cn(
                            "flex min-h-9 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                            selectedRoomId === "all"
                              ? "bg-[var(--accent-blue-soft)] font-semibold text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          <span>ทุกห้องเรียน ({rooms.length})</span>
                          {selectedRoomId === "all" && <Check size={15} weight="bold" />}
                        </button>
                        {rooms.map((room) => (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => {
                              setSelectedRoomId(room.id);
                              setRoomPopoverOpen(false);
                            }}
                            className={cn(
                              "flex min-h-9 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                              selectedRoomId === room.id
                                ? "bg-[var(--accent-blue-soft)] font-semibold text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            <span className="truncate">
                              {room.name}{" "}
                              <span className="text-xs text-[var(--text-muted)]">
                                · {room.program}
                              </span>
                            </span>
                            {selectedRoomId === room.id && (
                              <Check size={15} weight="bold" className="shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="md:col-span-3">
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="กรองตามวันที่"
                        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3.5 text-sm font-medium text-[var(--text-primary)] transition-colors duration-150 hover:border-[var(--border-strong)] cursor-pointer tabular-nums"
                      >
                        <span className="truncate">{selectedDateLabel}</span>
                        <CaretDown
                          size={15}
                          weight="bold"
                          className="shrink-0 text-[var(--text-muted)]"
                          aria-hidden="true"
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-1.5">
                      <div className="max-h-64 overflow-y-auto space-y-0.5 tabular-nums">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate("all");
                            setDatePopoverOpen(false);
                          }}
                          className={cn(
                            "flex min-h-9 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                            selectedDate === "all"
                              ? "bg-[var(--accent-blue-soft)] font-semibold text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          <span>ทุกวันที่ ({availableDates.length} วัน)</span>
                          {selectedDate === "all" && <Check size={15} weight="bold" />}
                        </button>
                        {availableDates.map((dateKey) => (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => {
                              setSelectedDate(dateKey);
                              setDatePopoverOpen(false);
                            }}
                            className={cn(
                              "flex min-h-9 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                              selectedDate === dateKey
                                ? "bg-[var(--accent-blue-soft)] font-semibold text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            <span>{formatThaiDateShort(dateKey)}</span>
                            {selectedDate === dateKey && <Check size={15} weight="bold" />}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </section>

            {groupedByDate.length === 0 ? (
              <div className="liquid-glass-panel mt-6 rounded-2xl px-6 py-10 text-center">
                <Funnel
                  size={28}
                  weight="regular"
                  className="mx-auto text-[var(--text-muted)]"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                  ไม่พบประวัติที่ตรงกับเงื่อนไขการค้นหา
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoomId("all");
                    setSelectedDate("all");
                    setSearchQuery("");
                  }}
                  className="mt-2 text-xs font-semibold text-[var(--accent-ink)] hover:underline cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {groupedByDate.map(([dateKey, dayRecords]) => (
                  <section key={dateKey} aria-label={formatThaiDateFull(dateKey)}>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      <CalendarBlank
                        size={17}
                        weight="regular"
                        className="text-[var(--accent-ink)]"
                        aria-hidden="true"
                      />
                      <h2>{formatThaiDateFull(dateKey)}</h2>
                      <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                        · {dayRecords.length} ห้อง
                      </span>
                    </div>

                    <div className="space-y-3">
                      {dayRecords.map((record) => {
                        const room = roomMap.get(record.roomId);
                        const roomStudents = studentsByRoom.get(record.roomId) ?? [];
                        const counts = computeAttendanceCounts(roomStudents, record.entries);
                        const total = Math.max(counts.total, 1);

                        const trimmedSearch = searchQuery.trim();
                        const matchedStudents = trimmedSearch
                          ? roomStudents.filter((s) => matchesStudentQuery(s, trimmedSearch))
                          : [];

                        return (
                          <article
                            key={record.id}
                            className="liquid-glass-panel group rounded-2xl p-4 transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] hover:shadow-md sm:p-5"
                          >
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                              <Link
                                href={`/rooms/${record.roomId}?date=${record.date}`}
                                className="min-w-0 flex-1"
                              >
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <h3 className="text-lg font-bold tracking-[-0.02em] text-[var(--text-primary)]">
                                    {room?.name ?? record.roomId}
                                  </h3>
                                  {room?.program && (
                                    <span className="text-xs text-[var(--text-muted)]">
                                      {room.program}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-1.5 tabular-nums">
                                  <Badge variant="present">มา {counts.present}</Badge>
                                  <Badge variant="late">สาย {counts.late}</Badge>
                                  <Badge variant="absent">ไม่มา {counts.absent}</Badge>
                                  <Badge variant="other">อื่นๆ {counts.other}</Badge>
                                  {counts.unmarked > 0 && (
                                    <Badge variant="muted">ยังไม่เช็ค {counts.unmarked}</Badge>
                                  )}
                                </div>

                                <div
                                  aria-hidden="true"
                                  className="mt-3 flex h-1 w-full max-w-xs overflow-hidden rounded-full bg-[var(--border-subtle)]"
                                >
                                  {counts.present > 0 && (
                                    <span
                                      className="h-full bg-[var(--status-present-border)]"
                                      style={{ width: `${(counts.present / total) * 100}%` }}
                                    />
                                  )}
                                  {counts.late > 0 && (
                                    <span
                                      className="h-full bg-[var(--status-late-border)]"
                                      style={{ width: `${(counts.late / total) * 100}%` }}
                                    />
                                  )}
                                  {counts.absent > 0 && (
                                    <span
                                      className="h-full bg-[var(--status-absent-border)]"
                                      style={{ width: `${(counts.absent / total) * 100}%` }}
                                    />
                                  )}
                                  {counts.other > 0 && (
                                    <span
                                      className="h-full bg-[var(--status-other-border)]"
                                      style={{ width: `${(counts.other / total) * 100}%` }}
                                    />
                                  )}
                                </div>
                              </Link>

                              <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-2.5 text-xs text-[var(--text-secondary)] sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                                <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
                                  <UserCircle
                                    size={16}
                                    weight="regular"
                                    className="text-[var(--text-muted)]"
                                    aria-hidden="true"
                                  />
                                  {record.checkedBy} · {formatThaiTime(record.updatedAt)}
                                </span>
                                <div className="flex items-center gap-2">
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTarget(record)}
                                      aria-label={`ลบประวัติห้อง ${room?.name ?? record.roomId}`}
                                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 text-xs font-medium text-[var(--status-absent-text)] transition-colors hover:border-[var(--status-absent-border)] hover:bg-[var(--status-absent-bg)] cursor-pointer"
                                    >
                                      <Trash size={14} weight="regular" aria-hidden="true" />
                                      <span>ลบ</span>
                                    </button>
                                  )}
                                  <Link
                                    href={`/rooms/${record.roomId}?date=${record.date}`}
                                    className="inline-flex min-h-8 items-center gap-1 font-semibold text-[var(--accent-ink)] transition-transform duration-150 group-hover:translate-x-0.5"
                                  >
                                    ดู / แก้ไข
                                    <ArrowRight size={14} weight="bold" aria-hidden="true" />
                                  </Link>
                                </div>
                              </div>
                            </div>

                            {matchedStudents.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] pt-3">
                                {matchedStudents.slice(0, 6).map((student) => {
                                  const entry = record.entries[student.id];
                                  return (
                                    <span
                                      key={student.id}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs"
                                    >
                                      <span className="font-semibold text-[var(--text-primary)]">
                                        {student.firstName} {student.lastName}
                                      </span>
                                      {student.nickname && (
                                        <span className="nickname-pill rounded px-1.5 py-0.5 text-[11px] font-semibold">
                                          |{student.nickname}|
                                        </span>
                                      )}
                                      <span className="text-[var(--text-secondary)]">
                                        · {entry ? STATUS_META[entry.status].label : "ยังไม่เช็ค"}
                                        {entry?.note ? ` (${entry.note})` : ""}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Admin Soft-Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => !nextOpen && !isDeleting && setDeleteTarget(null)}
      >
        <DialogContent closeLabel="ยกเลิก">
          <DialogHeader className="px-2">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--status-absent-bg)] text-[var(--status-absent-text)]">
              <Trash size={22} weight="fill" aria-hidden="true" />
            </div>
            <DialogTitle>ยืนยันลบประวัติการเช็คชื่อ</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  ต้องการลบประวัติการเช็คชื่อห้อง{" "}
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {roomMap.get(deleteTarget.roomId)?.name ?? deleteTarget.roomId}
                  </strong>{" "}
                  วันที่ {formatThaiDateShort(deleteTarget.date)} หรือไม่?
                  ระบบจะสร้าง Snapshot สำรองให้อัตโนมัติและสามารถกู้คืนได้จากหน้า Admin
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
            >
              {isDeleting ? "กำลังลบ..." : "ยืนยันลบประวัติ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
