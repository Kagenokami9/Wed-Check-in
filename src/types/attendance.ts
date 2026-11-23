export type AttendanceStatus = "present" | "absent" | "late" | "other";

export type AttendanceFilter = AttendanceStatus | "unmarked" | "all";

export type StaffRole = "member" | "admin";

export interface Room {
  id: string; // e.g. "m1-5"
  name: string; // e.g. "ม.1/5"
  grade: number; // e.g. 1 (for automatic sorting)
  roomNumber: number; // e.g. 5
  program: string; // e.g. "แผนการเรียนทั่วไป"
  homeroomTeachers: string;
}

export interface Student {
  id: string; // Unique key (matches studentCode unless disambiguated)
  studentCode: string; // 5-digit student code e.g. "00001"
  roomId: string; // FK -> Room.id
  seatNumber: number; // Seat number in room
  prefix: string; // Title prefix e.g. "เด็กชาย", "นาย"
  firstName: string;
  lastName: string;
  nickname?: string; // Custom staff-managed nickname
  rosterNote?: string; // Roster remark e.g. "ขาดเรียนนาน 11 พฤศจิกายน 2568"
}

export interface RosterData {
  sourceFile: string;
  academicYear: string;
  generatedAt: string;
  rooms: Room[];
  students: Student[];
}

export interface AttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
  note?: string; // Optional remark when status === "other"
}

export interface RoomDailyAttendance {
  id: string; // `${roomId}_${date}` (UNIQUE room + date)
  roomId: string;
  date: string; // "YYYY-MM-DD" in local timezone
  entries: Record<string, AttendanceEntry>;
  checkedBy: string; // Staff display name
  version: number; // Optimistic concurrency version counter
  updatedAt: string; // ISO timestamp
}

export interface StaffSession {
  staffName: string;
  role: StaffRole;
  loggedInAt: string;
}

export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  other: number;
  unmarked: number;
  total: number;
  checkedCount: number;
  attendanceRate: number; // 0-100 percentage of present + late over checked
}

export interface AttendanceConflictInfo {
  currentVersion: number;
  currentCheckedBy: string;
  currentUpdatedAt: string;
}

export interface AuditLogItem {
  id: number;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
}

export interface SnapshotSummaryItem {
  id: number;
  reason: string;
  createdBy: string;
  checksumSha256: string;
  createdAt: string;
  counts: {
    rooms: number;
    students: number;
    sessions: number;
    entries: number;
  };
}
