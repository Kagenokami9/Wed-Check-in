import type {
  AttendanceConflictInfo,
  Room,
  RoomDailyAttendance,
  Student,
} from "@/types/attendance";
import type { AttendanceRepository, SaveRoomAttendanceInput } from "./types";

export const DATA_CHANGED_EVENT = "blue-checkin:data-changed";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    code = "API_ERROR",
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class AttendanceConflictError extends ApiClientError {
  readonly conflict: AttendanceConflictInfo;

  constructor(message: string, conflict: AttendanceConflictInfo) {
    super(409, message, "VERSION_CONFLICT", conflict as unknown as Record<string, unknown>);
    this.name = "AttendanceConflictError";
    this.conflict = conflict;
  }
}

function notifyDataChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : `เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ (${response.status})`;
    const code = typeof payload.code === "string" ? payload.code : "API_ERROR";
    const details =
      payload.details && typeof payload.details === "object"
        ? (payload.details as Record<string, unknown>)
        : undefined;

    if (response.status === 409 && code === "VERSION_CONFLICT" && details) {
      throw new AttendanceConflictError(message, {
        currentVersion: Number(details.currentVersion ?? 1),
        currentCheckedBy: String(details.currentCheckedBy ?? "สตาฟท่านอื่น"),
        currentUpdatedAt: String(details.currentUpdatedAt ?? new Date().toISOString()),
      });
    }

    throw new ApiClientError(response.status, message, code, details);
  }

  return payload as T;
}

/**
 * Server-backed AttendanceRepository calling Next.js BFF Route Handlers (/api/*).
 * Fail-closed: never silently falls back to localStorage if the backend is unavailable.
 */
export class ApiAttendanceRepository implements AttendanceRepository {
  async getRooms(): Promise<Room[]> {
    const data = await apiFetch<{ rooms: Room[] }>("/api/rooms");
    return data.rooms;
  }

  async getRoomDetail(roomId: string): Promise<{
    room: Room | null;
    students: Student[];
    checkedDates: string[];
  }> {
    try {
      return await apiFetch<{
        room: Room | null;
        students: Student[];
        checkedDates: string[];
      }>(`/api/rooms/${encodeURIComponent(roomId)}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        return { room: null, students: [], checkedDates: [] };
      }
      throw error;
    }
  }

  async getRoomById(roomId: string): Promise<Room | null> {
    const detail = await this.getRoomDetail(roomId);
    return detail.room;
  }

  async getStudentsByRoom(roomId: string): Promise<Student[]> {
    const detail = await this.getRoomDetail(roomId);
    return detail.students;
  }

  async getAllStudents(): Promise<Student[]> {
    const data = await apiFetch<{ students: Student[] }>("/api/students");
    return data.students;
  }

  async getRoomAttendance(roomId: string, date: string): Promise<RoomDailyAttendance | null> {
    const data = await apiFetch<{ record: RoomDailyAttendance | null }>(
      `/api/rooms/${encodeURIComponent(roomId)}/attendance?date=${encodeURIComponent(date)}`
    );
    return data.record;
  }

  async getAttendanceByDate(date: string): Promise<RoomDailyAttendance[]> {
    const data = await apiFetch<{ records: RoomDailyAttendance[] }>(
      `/api/attendance?date=${encodeURIComponent(date)}`
    );
    return data.records;
  }

  async getAllAttendance(): Promise<RoomDailyAttendance[]> {
    const data = await apiFetch<{ records: RoomDailyAttendance[] }>("/api/attendance");
    return data.records;
  }

  async getCheckedDatesForRoom(roomId: string): Promise<string[]> {
    const detail = await this.getRoomDetail(roomId);
    return detail.checkedDates;
  }

  async saveRoomAttendance(input: SaveRoomAttendanceInput): Promise<RoomDailyAttendance> {
    const data = await apiFetch<{ record: RoomDailyAttendance }>(
      `/api/rooms/${encodeURIComponent(input.roomId)}/attendance`,
      {
        method: "POST",
        body: JSON.stringify({
          date: input.date,
          entries: input.entries,
          expectedVersion: input.expectedVersion ?? null,
          force: Boolean(input.force),
        }),
      }
    );
    notifyDataChanged();
    return data.record;
  }

  async deleteRoomAttendance(roomId: string, date: string): Promise<void> {
    await apiFetch<{ ok: boolean }>(
      `/api/rooms/${encodeURIComponent(roomId)}/attendance?date=${encodeURIComponent(date)}`,
      { method: "DELETE" }
    );
    notifyDataChanged();
  }

  async updateStudentNickname(studentId: string, nickname: string): Promise<void> {
    await apiFetch<{ studentId: string; nickname: string }>(
      `/api/students/${encodeURIComponent(studentId)}/nickname`,
      {
        method: "PATCH",
        body: JSON.stringify({ nickname }),
      }
    );
    notifyDataChanged();
  }
}
