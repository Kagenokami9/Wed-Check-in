"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { AppShell } from "@/components/layout/app-shell";
import { HeroHeader } from "@/components/home/hero-header";
import { RoomCard } from "@/components/home/room-card";
import { DataErrorCard } from "@/components/shared/data-error-card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { computeAttendanceCounts } from "@/lib/attendance-helpers";
import {
  ApiClientError,
  attendanceRepository,
  DATA_CHANGED_EVENT,
} from "@/lib/repositories";
import { cn, getTodayDateKey } from "@/lib/utils";
import type { Room, RoomDailyAttendance, Student } from "@/types/attendance";

export default function HomePage() {
  const router = useRouter();
  const { session } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [todayRecords, setTodayRecords] = useState<RoomDailyAttendance[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; status?: number } | null>(null);

  const todayKey = getTodayDateKey();

  const loadHomeData = useCallback(async () => {
    setLoadError(null);
    try {
      const [loadedRooms, loadedStudents, loadedToday] = await Promise.all([
        attendanceRepository.getRooms(),
        attendanceRepository.getAllStudents(),
        attendanceRepository.getAttendanceByDate(todayKey),
      ]);
      setRooms(loadedRooms);
      setStudents(loadedStudents);
      setTodayRecords(loadedToday);
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
  }, [router, todayKey]);

  useEffect(() => {
    loadHomeData();
    const onDataChange = () => {
      loadHomeData();
    };
    window.addEventListener(DATA_CHANGED_EVENT, onDataChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onDataChange);
  }, [loadHomeData]);

  // Dynamically derive grade tabs from loaded rooms (zero hardcoded grade list)
  const availableGrades = useMemo(() => {
    const gradeSet = new Set(rooms.map((room) => room.grade));
    return Array.from(gradeSet).sort((a, b) => a - b);
  }, [rooms]);

  const studentsByRoom = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const student of students) {
      const list = map.get(student.roomId) ?? [];
      list.push(student);
      map.set(student.roomId, list);
    }
    return map;
  }, [students]);

  const todayRecordByRoom = useMemo(() => {
    return new Map(todayRecords.map((record) => [record.roomId, record]));
  }, [todayRecords]);

  const checkedRoomsToday = useMemo(() => {
    return rooms.filter((room) => {
      const record = todayRecordByRoom.get(room.id);
      return record && Object.keys(record.entries).length > 0;
    }).length;
  }, [rooms, todayRecordByRoom]);

  const filteredRooms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rooms.filter((room) => {
      if (selectedGrade !== "all" && room.grade !== selectedGrade) {
        return false;
      }
      if (!query) return true;
      return (
        room.name.toLowerCase().includes(query) ||
        room.program.toLowerCase().includes(query) ||
        room.homeroomTeachers.toLowerCase().includes(query)
      );
    });
  }, [rooms, selectedGrade, searchQuery]);

  const roomIndexMap = useMemo(() => {
    return new Map(rooms.map((room, index) => [room.id, index]));
  }, [rooms]);

  const groupedByGrade = useMemo(() => {
    const groups = new Map<number, Room[]>();
    for (const room of filteredRooms) {
      const list = groups.get(room.grade) ?? [];
      list.push(room);
      groups.set(room.grade, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [filteredRooms]);

  const shouldGroupByGrade =
    selectedGrade === "all" && !searchQuery.trim() && groupedByGrade.length > 1;

  const renderRoomGrid = (roomList: Room[]) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {roomList.map((room) => {
        const roomStudents = studentsByRoom.get(room.id) ?? [];
        const savedToday = todayRecordByRoom.get(room.id);
        const counts = computeAttendanceCounts(roomStudents, savedToday?.entries);
        const hasSavedToday = Boolean(
          savedToday && Object.keys(savedToday.entries).length > 0
        );

        return (
          <RoomCard
            key={room.id}
            room={room}
            roomIndex={roomIndexMap.get(room.id) ?? 0}
            counts={counts}
            hasSavedToday={hasSavedToday}
          />
        );
      })}
    </div>
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <HeroHeader
          todayDateKey={todayKey}
          checkedRoomsCount={checkedRoomsToday}
          totalRoomsCount={rooms.length}
          staffName={session?.staffName ?? "สตาฟสีฟ้า"}
          staffRole={session?.role ?? "member"}
        />

        {/* Room Filter & Search Toolbar */}
        <section
          aria-label="กรองและค้นหาห้องเรียน"
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="กรองตามระดับชั้น">
            <button
              type="button"
              onClick={() => setSelectedGrade("all")}
              aria-pressed={selectedGrade === "all"}
              className={cn(
                "min-h-10 rounded-xl border px-3.5 text-xs font-semibold transition-[background-color,border-color,color] duration-150 cursor-pointer sm:text-sm tabular-nums",
                selectedGrade === "all"
                  ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-xs"
                  : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              )}
            >
              ทุกห้อง ({rooms.length})
            </button>

            {availableGrades.map((grade) => {
              const isSelected = selectedGrade === grade;
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setSelectedGrade(grade)}
                  aria-pressed={isSelected}
                  className={cn(
                    "min-h-10 rounded-xl border px-3.5 text-xs font-semibold transition-[background-color,border-color,color] duration-150 cursor-pointer sm:text-sm",
                    isSelected
                      ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-xs"
                      : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  )}
                >
                  ม.{grade}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
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
              placeholder="ค้นหาห้องหรือแผนการเรียน"
              aria-label="ค้นหาห้องเรียน"
              className="pl-10 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="ล้างคำค้นหาห้อง"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={14} weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>

        {/* Dynamic Liquid Glass Room Grid grouped by grade level */}
        <section aria-label="รายชื่อห้องเรียนคณะสีฟ้า" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="liquid-glass-panel h-44 animate-pulse rounded-3xl"
                />
              ))}
            </div>
          ) : loadError ? (
            <DataErrorCard
              message={loadError.message}
              status={loadError.status}
              onRetry={() => {
                setLoading(true);
                loadHomeData();
              }}
            />
          ) : filteredRooms.length === 0 ? (
            <div className="liquid-glass-panel rounded-3xl px-6 py-12 text-center">
              <p className="text-base font-semibold text-[var(--text-primary)]">
                ไม่พบห้องเรียนที่ตรงกับคำค้นหา
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                ลองเปลี่ยนระดับชั้นหรือล้างคำค้นหาเพื่อดูห้องเรียนทั้งหมด
              </p>
            </div>
          ) : shouldGroupByGrade ? (
            <div className="space-y-8">
              {groupedByGrade.map(([grade, gradeRooms]) => (
                <div key={grade}>
                  <div className="mb-3 flex items-center gap-2.5 px-1">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                      มัธยมศึกษาปีที่ {grade}
                    </h2>
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-px bg-[var(--border-strong)]"
                    />
                    <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                      {gradeRooms.length} ห้อง
                    </span>
                  </div>
                  {renderRoomGrid(gradeRooms)}
                </div>
              ))}
            </div>
          ) : (
            renderRoomGrid(filteredRooms)
          )}
        </section>
      </main>
    </AppShell>
  );
}
