import { STATUS_META } from "@/lib/attendance-helpers";
import { formatThaiDateShort, formatThaiTime, getTodayDateKey } from "@/lib/utils";
import type { Room, RoomDailyAttendance, Student } from "@/types/attendance";

function escapeCsvCell(value: string | number | undefined): string {
  const str = value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a UTF-8 with BOM CSV string so Thai characters open cleanly in Microsoft Excel & Google Sheets.
 */
export function buildAttendanceCsv(
  records: RoomDailyAttendance[],
  rooms: Room[],
  students: Student[]
): string {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const studentsByRoom = new Map<string, Student[]>();

  for (const student of students) {
    const list = studentsByRoom.get(student.roomId) ?? [];
    list.push(student);
    studentsByRoom.set(student.roomId, list);
  }

  const headers = [
    "วันที่",
    "วันที่ (พ.ศ.)",
    "ห้องเรียน",
    "แผนการเรียน",
    "เลขที่",
    "รหัสนักเรียน",
    "คำนำหน้า",
    "ชื่อ",
    "นามสกุล",
    "ชื่อเล่น",
    "สถานะเช็คชื่อ",
    "หมายเหตุ",
    "หมายเหตุใบรายชื่อ",
    "ผู้เช็คชื่อ",
    "เวลาบันทึก",
  ];

  const rows: string[][] = [headers];

  const sortedRecords = [...records].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const roomA = roomMap.get(a.roomId);
    const roomB = roomMap.get(b.roomId);
    if (!roomA || !roomB) return a.roomId.localeCompare(b.roomId);
    if (roomA.grade !== roomB.grade) return roomA.grade - roomB.grade;
    return roomA.roomNumber - roomB.roomNumber;
  });

  for (const record of sortedRecords) {
    const room = roomMap.get(record.roomId);
    const roomStudents = (studentsByRoom.get(record.roomId) ?? []).sort(
      (a, b) => a.seatNumber - b.seatNumber
    );

    for (const student of roomStudents) {
      const entry = record.entries[student.id];
      const statusLabel = entry ? STATUS_META[entry.status].label : "ยังไม่เช็ค";
      rows.push([
        record.date,
        formatThaiDateShort(record.date),
        room?.name ?? record.roomId,
        room?.program ?? "",
        String(student.seatNumber),
        student.studentCode,
        student.prefix,
        student.firstName,
        student.lastName,
        student.nickname ?? "",
        statusLabel,
        entry?.note ?? "",
        student.rosterNote ?? "",
        record.checkedBy,
        formatThaiTime(record.updatedAt),
      ]);
    }
  }

  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  // Prepend UTF-8 BOM for Thai Excel compatibility
  return `\uFEFF${csvBody}`;
}

export function downloadAttendanceCsv(
  records: RoomDailyAttendance[],
  rooms: Room[],
  students: Student[],
  rangeSuffix = "all"
): void {
  const csvContent = buildAttendanceCsv(records, rooms, students);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `blue-checkin-${rangeSuffix}-${getTodayDateKey()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
