"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  Users,
} from "@phosphor-icons/react";
import { DataErrorCard } from "@/components/shared/data-error-card";
import { useToast } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AdminRoomRow {
  id: string;
  name: string;
  grade: number;
  roomNumber: number;
  program: string;
  homeroomTeachers: string;
  deletedAt: string | null;
  updatedAt: string;
}

interface AdminStudentRow {
  id: string;
  studentCode: string;
  roomId: string;
  seatNumber: number;
  prefix: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  rosterNote?: string;
  deletedAt: string | null;
  updatedAt: string;
}

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (${res.status})`
    );
  }
  return data as T;
}

export function RosterManagerTab() {
  const { showToast } = useToast();
  const [rooms, setRooms] = useState<AdminRoomRow[]>([]);
  const [students, setStudents] = useState<AdminStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [studentQuery, setStudentQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Room Dialog State
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<AdminRoomRow | null>(null);
  const [roomGrade, setRoomGrade] = useState("1");
  const [roomNumber, setRoomNumber] = useState("1");
  const [roomName, setRoomName] = useState("");
  const [roomProgram, setRoomProgram] = useState("");
  const [roomTeachers, setRoomTeachers] = useState("");
  const [roomSaving, setRoomSaving] = useState(false);

  // Student Dialog State
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AdminStudentRow | null>(null);
  const [stCode, setStCode] = useState("");
  const [stRoomId, setStRoomId] = useState("");
  const [stSeat, setStSeat] = useState("1");
  const [stPrefix, setStPrefix] = useState("เด็กชาย");
  const [stFirstName, setStFirstName] = useState("");
  const [stLastName, setStLastName] = useState("");
  const [stNickname, setStNickname] = useState("");
  const [stNote, setStNote] = useState("");
  const [studentSaving, setStudentSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [roomsRes, studentsRes] = await Promise.all([
        adminFetch<{ rooms: AdminRoomRow[] }>("/api/admin/rooms"),
        adminFetch<{ students: AdminStudentRow[] }>("/api/admin/students"),
      ]);
      setRooms(roomsRes.rooms);
      setStudents(studentsRes.students);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลห้องและนักเรียนได้"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeRooms = useMemo(() => rooms.filter((r) => !r.deletedAt), [rooms]);
  const visibleRooms = useMemo(
    () => (showDeleted ? rooms : activeRooms),
    [rooms, activeRooms, showDeleted]
  );

  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const studentCountByRoom = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students) {
      if (s.deletedAt) continue;
      map.set(s.roomId, (map.get(s.roomId) ?? 0) + 1);
    }
    return map;
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (!showDeleted && s.deletedAt) return false;
      if (selectedRoomId !== "all" && s.roomId !== selectedRoomId) return false;
      if (!q) return true;
      return (
        s.studentCode.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        (s.nickname ?? "").toLowerCase().includes(q) ||
        String(s.seatNumber) === q
      );
    });
  }, [students, showDeleted, selectedRoomId, studentQuery]);

  const openCreateRoom = () => {
    setEditingRoom(null);
    setRoomGrade("1");
    setRoomNumber("1");
    setRoomName("");
    setRoomProgram("");
    setRoomTeachers("");
    setRoomDialogOpen(true);
  };

  const openEditRoom = (room: AdminRoomRow) => {
    setEditingRoom(room);
    setRoomGrade(String(room.grade));
    setRoomNumber(String(room.roomNumber));
    setRoomName(room.name);
    setRoomProgram(room.program);
    setRoomTeachers(room.homeroomTeachers);
    setRoomDialogOpen(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomSaving(true);
    try {
      if (editingRoom) {
        await adminFetch(`/api/admin/rooms/${encodeURIComponent(editingRoom.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: roomName.trim() || editingRoom.name,
            program: roomProgram.trim(),
            homeroomTeachers: roomTeachers.trim(),
          }),
        });
        showToast(`แก้ไขข้อมูลห้อง ${roomName || editingRoom.name} เรียบร้อยแล้ว`, "success");
      } else {
        await adminFetch("/api/admin/rooms", {
          method: "POST",
          body: JSON.stringify({
            grade: Number(roomGrade),
            roomNumber: Number(roomNumber),
            program: roomProgram.trim(),
            homeroomTeachers: roomTeachers.trim(),
          }),
        });
        showToast(`เพิ่มห้องเรียน ม.${roomGrade}/${roomNumber} เรียบร้อยแล้ว`, "success");
      }
      setRoomDialogOpen(false);
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "บันทึกห้องเรียนไม่สำเร็จ", "error");
    } finally {
      setRoomSaving(false);
    }
  };

  const handleDeleteRoom = async (room: AdminRoomRow) => {
    setBusyId(`room:${room.id}`);
    try {
      await adminFetch(`/api/admin/rooms/${encodeURIComponent(room.id)}`, {
        method: "DELETE",
      });
      showToast(`ซ่อน/ลบห้อง ${room.name} แล้ว (กู้คืนได้ทุกเมื่อ)`, "info");
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ลบห้องเรียนไม่สำเร็จ", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleRestoreItem = async (entityType: "room" | "student", entityId: string, label: string) => {
    setBusyId(`${entityType}:${entityId}`);
    try {
      await adminFetch("/api/admin/restore/item", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId }),
      });
      showToast(`กู้คืน ${label} เรียบร้อยแล้ว`, "success");
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "กู้คืนไม่สำเร็จ", "error");
    } finally {
      setBusyId(null);
    }
  };

  const openCreateStudent = () => {
    const defaultRoom =
      selectedRoomId !== "all" ? selectedRoomId : activeRooms[0]?.id ?? "";
    const nextSeat = (studentCountByRoom.get(defaultRoom) ?? 0) + 1;
    setEditingStudent(null);
    setStCode("");
    setStRoomId(defaultRoom);
    setStSeat(String(nextSeat));
    setStPrefix("เด็กชาย");
    setStFirstName("");
    setStLastName("");
    setStNickname("");
    setStNote("");
    setStudentDialogOpen(true);
  };

  const openEditStudent = (student: AdminStudentRow) => {
    setEditingStudent(student);
    setStCode(student.studentCode);
    setStRoomId(student.roomId);
    setStSeat(String(student.seatNumber));
    setStPrefix(student.prefix);
    setStFirstName(student.firstName);
    setStLastName(student.lastName);
    setStNickname(student.nickname ?? "");
    setStNote(student.rosterNote ?? "");
    setStudentDialogOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentSaving(true);
    try {
      const payload = {
        studentCode: stCode.trim(),
        roomId: stRoomId,
        seatNumber: Number(stSeat),
        prefix: stPrefix.trim(),
        firstName: stFirstName.trim(),
        lastName: stLastName.trim(),
        nickname: stNickname.trim() || undefined,
        rosterNote: stNote.trim() || undefined,
      };
      if (editingStudent) {
        await adminFetch(`/api/admin/students/${encodeURIComponent(editingStudent.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...payload,
            nickname: stNickname.trim() || null,
            rosterNote: stNote.trim() || null,
          }),
        });
        showToast(`แก้ไขข้อมูล ${stFirstName} ${stLastName} เรียบร้อยแล้ว`, "success");
      } else {
        await adminFetch("/api/admin/students", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast(`เพิ่มนักเรียน ${stFirstName} ${stLastName} เรียบร้อยแล้ว`, "success");
      }
      setStudentDialogOpen(false);
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "บันทึกข้อมูลนักเรียนไม่สำเร็จ", "error");
    } finally {
      setStudentSaving(false);
    }
  };

  const handleDeleteStudent = async (student: AdminStudentRow) => {
    setBusyId(`student:${student.id}`);
    try {
      await adminFetch(`/api/admin/students/${encodeURIComponent(student.id)}`, {
        method: "DELETE",
      });
      showToast(`ซ่อน/ลบ ${student.firstName} ${student.lastName} แล้ว`, "info");
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ลบรายชื่อนักเรียนไม่สำเร็จ", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="liquid-glass-panel h-24 animate-pulse rounded-2xl" />
        <div className="liquid-glass-panel h-64 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return <DataErrorCard message={loadError} onRetry={loadData} />;
  }

  const activeStudentsCount = students.filter((s) => !s.deletedAt).length;
  const deletedCount =
    rooms.filter((r) => Boolean(r.deletedAt)).length +
    students.filter((s) => Boolean(s.deletedAt)).length;

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="liquid-glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] tabular-nums">
          <Badge variant="default">ห้องใช้งาน {activeRooms.length} ห้อง</Badge>
          <Badge variant="default">นักเรียนใช้งาน {activeStudentsCount} คน</Badge>
          {deletedCount > 0 && <Badge variant="muted">ถูกลบ (Soft Delete) {deletedCount}</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDeleted((v) => !v)}
            aria-pressed={showDeleted}
            className={cn(
              "min-h-9 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer",
              showDeleted
                ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-soft)] text-[var(--text-primary)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {showDeleted ? "กำลังแสดงรายการที่ลบแล้ว" : "แสดงรายการที่ลบแล้ว"}
          </button>
          <Button type="button" size="sm" variant="outline" onClick={openCreateRoom}>
            <Plus size={15} weight="bold" aria-hidden="true" />
            <span>เพิ่มห้องเรียน</span>
          </Button>
          <Button type="button" size="sm" onClick={openCreateStudent}>
            <Plus size={15} weight="bold" aria-hidden="true" />
            <span>เพิ่มนักเรียน</span>
          </Button>
        </div>
      </div>

      {/* Rooms Management Card */}
      <section className="liquid-glass-panel rounded-3xl p-5">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          จัดการห้องเรียน ({visibleRooms.length})
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRooms.map((room) => {
            const isDeleted = Boolean(room.deletedAt);
            const count = studentCountByRoom.get(room.id) ?? 0;
            const isBusy = busyId === `room:${room.id}`;

            return (
              <div
                key={room.id}
                className={cn(
                  "rounded-2xl border p-4 transition-colors",
                  isDeleted
                    ? "border-[var(--status-absent-border)]/40 bg-[var(--status-absent-bg)]/30 opacity-80"
                    : "border-[var(--border-subtle)] bg-[var(--surface-elevated)]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[var(--text-primary)]">
                        {room.name}
                      </h3>
                      {isDeleted ? (
                        <Badge variant="absent">ถูกลบ</Badge>
                      ) : (
                        <Badge variant="muted">{count} คน</Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">
                      {room.program || "ไม่ระบุแผนการเรียน"}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-muted)]">
                      {room.homeroomTeachers || "ไม่ระบุครูที่ปรึกษา"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-[var(--border-subtle)] pt-2.5">
                  {isDeleted ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => handleRestoreItem("room", room.id, room.name)}
                    >
                      <ArrowCounterClockwise size={14} weight="bold" aria-hidden="true" />
                      <span>กู้คืนห้อง</span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditRoom(room)}
                      >
                        <PencilSimple size={14} weight="regular" aria-hidden="true" />
                        <span>แก้ไข</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => handleDeleteRoom(room)}
                        className="text-[var(--status-absent-text)] hover:bg-[var(--status-absent-bg)]"
                      >
                        <Trash size={14} weight="regular" aria-hidden="true" />
                        <span>ลบ</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Students Management Card */}
      <section className="liquid-glass-panel rounded-3xl p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Users size={18} weight="regular" className="text-[var(--accent-ink)]" aria-hidden="true" />
            <h2 className="text-base font-bold text-[var(--text-primary)] tabular-nums">
              จัดการรายชื่อนักเรียน ({filteredStudents.length})
            </h2>
          </div>

          <div className="relative w-full sm:w-64">
            <MagnifyingGlass
              size={15}
              weight="regular"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <Input
              type="search"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="ค้นหารหัส ชื่อ หรือชื่อเล่น"
              aria-label="ค้นหานักเรียน"
              className="min-h-10 pl-9 text-xs"
            />
          </div>
        </div>

        {/* Room filter pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedRoomId("all")}
            className={cn(
              "min-h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer",
              selectedRoomId === "all"
                ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            ทุกห้อง
          </button>
          {activeRooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRoomId(r.id)}
              className={cn(
                "min-h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer tabular-nums",
                selectedRoomId === r.id
                  ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* Students table */}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
          <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
              <tr>
                <th className="px-3 py-2.5">ห้อง / เลขที่</th>
                <th className="px-3 py-2.5">รหัส</th>
                <th className="px-3 py-2.5">ชื่อ - นามสกุล</th>
                <th className="px-3 py-2.5">ชื่อเล่น</th>
                <th className="px-3 py-2.5 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] tabular-nums">
              {filteredStudents.slice(0, 120).map((student) => {
                const isDeleted = Boolean(student.deletedAt);
                const isBusy = busyId === `student:${student.id}`;
                return (
                  <tr
                    key={student.id}
                    className={cn(
                      "transition-colors hover:bg-[var(--accent-blue-soft)]/25",
                      isDeleted && "bg-[var(--status-absent-bg)]/20 opacity-75"
                    )}
                  >
                    <td className="px-3 py-2.5 font-medium text-[var(--text-secondary)]">
                      {roomMap.get(student.roomId)?.name ?? student.roomId} · #{student.seatNumber}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-muted)]">
                      {student.studentCode}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-[var(--text-primary)]">
                        {student.prefix}
                        {student.firstName} {student.lastName}
                      </span>
                      {isDeleted && (
                        <Badge variant="absent" className="ml-2">
                          ถูกลบ
                        </Badge>
                      )}
                      {student.rosterNote && (
                        <p className="text-[11px] text-[var(--text-muted)]">{student.rosterNote}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {student.nickname ? (
                        <Badge variant="nickname">|{student.nickname}|</Badge>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {isDeleted ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() =>
                              handleRestoreItem(
                                "student",
                                student.id,
                                `${student.firstName} ${student.lastName}`
                              )
                            }
                          >
                            <ArrowCounterClockwise size={13} weight="bold" aria-hidden="true" />
                            <span>กู้คืน</span>
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditStudent(student)}
                            >
                              <PencilSimple size={14} weight="regular" aria-hidden="true" />
                              <span className="sr-only sm:not-sr-only">แก้ไข</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => handleDeleteStudent(student)}
                              className="text-[var(--status-absent-text)] hover:bg-[var(--status-absent-bg)]"
                            >
                              <Trash size={14} weight="regular" aria-hidden="true" />
                              <span className="sr-only sm:not-sr-only">ลบ</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredStudents.length > 120 && (
            <p className="border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-center text-xs text-[var(--text-muted)]">
              แสดง 120 จาก {filteredStudents.length} คน — เลือกห้องหรือพิมพ์คำค้นหาเพื่อดูรายการที่ต้องการ
            </p>
          )}
        </div>
      </section>

      {/* Room Create/Edit Dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? `แก้ไขห้อง ${editingRoom.name}` : "เพิ่มห้องเรียนใหม่"}</DialogTitle>
            <DialogDescription>
              ข้อมูลจะถูกบันทึกลง Supabase และแสดงผลทันทีสำหรับสตาฟทุกคน
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRoom} className="mt-4 space-y-3">
            {!editingRoom ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    ระดับชั้น (ม.)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    value={roomGrade}
                    onChange={(e) => setRoomGrade(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    เลขห้อง
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  ชื่อห้องเรียน
                </label>
                <Input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                แผนการเรียน
              </label>
              <Input
                value={roomProgram}
                onChange={(e) => setRoomProgram(e.target.value)}
                placeholder="เช่น แผนการเรียนวิทยาศาสตร์ - คณิตศาสตร์"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                ครูที่ปรึกษา
              </label>
              <Input
                value={roomTeachers}
                onChange={(e) => setRoomTeachers(e.target.value)}
                placeholder="ระบุชื่อครูที่ปรึกษา"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoomDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={roomSaving}>
                {roomSaving ? "กำลังบันทึก..." : "บันทึกห้องเรียน"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Student Create/Edit Dialog */}
      <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStudent ? "แก้ไขข้อมูลนักเรียน" : "เพิ่มรายชื่อนักเรียนใหม่"}
            </DialogTitle>
            <DialogDescription>
              ระบบจะบันทึกประวัติการแก้ไขลง Audit Log อัตโนมัติ
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveStudent} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  ห้องเรียน
                </label>
                <select
                  value={stRoomId}
                  onChange={(e) => setStRoomId(e.target.value)}
                  required
                  className="min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3 text-sm text-[var(--text-primary)]"
                >
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  เลขที่
                </label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={stSeat}
                  onChange={(e) => setStSeat(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  รหัสนักเรียน
                </label>
                <Input
                  value={stCode}
                  onChange={(e) => setStCode(e.target.value)}
                  placeholder="เช่น 29999"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  คำนำหน้า
                </label>
                <Input
                  value={stPrefix}
                  onChange={(e) => setStPrefix(e.target.value)}
                  placeholder="เด็กชาย / เด็กหญิง / นาย / นางสาว"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  ชื่อจริง
                </label>
                <Input
                  value={stFirstName}
                  onChange={(e) => setStFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  นามสกุล
                </label>
                <Input
                  value={stLastName}
                  onChange={(e) => setStLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  ชื่อเล่น (ไม่บังคับ)
                </label>
                <Input
                  value={stNickname}
                  onChange={(e) => setStNickname(e.target.value)}
                  maxLength={24}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  หมายเหตุรายชื่อ
                </label>
                <Input
                  value={stNote}
                  onChange={(e) => setStNote(e.target.value)}
                  maxLength={160}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStudentDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={studentSaving}>
                {studentSaving ? "กำลังบันทึก..." : "บันทึกข้อมูลนักเรียน"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
