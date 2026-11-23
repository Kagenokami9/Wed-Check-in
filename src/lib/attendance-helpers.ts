import type {
  AttendanceCounts,
  AttendanceEntry,
  AttendanceStatus,
  Room,
  Student,
} from "@/types/attendance";

export const STATUS_META: Record<
  AttendanceStatus,
  {
    label: string;
    shortLabel: string;
    bgVar: string;
    borderVar: string;
    textVar: string;
  }
> = {
  present: {
    label: "มา",
    shortLabel: "มา",
    bgVar: "var(--status-present-bg)",
    borderVar: "var(--status-present-border)",
    textVar: "var(--status-present-text)",
  },
  absent: {
    label: "ไม่มา",
    shortLabel: "ไม่มา",
    bgVar: "var(--status-absent-bg)",
    borderVar: "var(--status-absent-border)",
    textVar: "var(--status-absent-text)",
  },
  late: {
    label: "สาย",
    shortLabel: "สาย",
    bgVar: "var(--status-late-bg)",
    borderVar: "var(--status-late-border)",
    textVar: "var(--status-late-text)",
  },
  other: {
    label: "อื่นๆ",
    shortLabel: "อื่นๆ",
    bgVar: "var(--status-other-bg)",
    borderVar: "var(--status-other-border)",
    textVar: "var(--status-other-text)",
  },
};

export function computeAttendanceCounts(
  students: Pick<Student, "id">[],
  entries: Record<string, AttendanceEntry> | undefined
): AttendanceCounts {
  let present = 0;
  let absent = 0;
  let late = 0;
  let other = 0;

  for (const student of students) {
    const entry = entries?.[student.id];
    if (!entry) continue;
    switch (entry.status) {
      case "present":
        present += 1;
        break;
      case "absent":
        absent += 1;
        break;
      case "late":
        late += 1;
        break;
      case "other":
        other += 1;
        break;
    }
  }

  const total = students.length;
  const checkedCount = present + absent + late + other;
  const unmarked = Math.max(0, total - checkedCount);
  const attendanceRate =
    checkedCount > 0 ? Math.round(((present + late) / checkedCount) * 1000) / 10 : 0;

  return {
    present,
    absent,
    late,
    other,
    unmarked,
    total,
    checkedCount,
    attendanceRate,
  };
}

export function sortRoomsDynamically(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.roomNumber - b.roomNumber;
  });
}

export function getDirtyEntryCount(
  students: Pick<Student, "id">[],
  savedEntries: Record<string, AttendanceEntry>,
  draftEntries: Record<string, AttendanceEntry>
): number {
  let changes = 0;
  for (const student of students) {
    const saved = savedEntries[student.id];
    const draft = draftEntries[student.id];
    const savedStatus = saved?.status ?? "";
    const draftStatus = draft?.status ?? "";
    const savedNote = (saved?.note ?? "").trim();
    const draftNote = (draft?.note ?? "").trim();

    if (savedStatus !== draftStatus || savedNote !== draftNote) {
      changes += 1;
    }
  }
  return changes;
}

export function matchesStudentQuery(student: Student, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const fullName = `${student.prefix}${student.firstName} ${student.lastName}`.toLowerCase();
  const shortName = `${student.firstName} ${student.lastName}`.toLowerCase();
  const nickname = (student.nickname ?? "").toLowerCase();
  const seatStr = String(student.seatNumber);
  const code = student.studentCode.toLowerCase();

  return (
    fullName.includes(query) ||
    shortName.includes(query) ||
    nickname.includes(query) ||
    seatStr === query ||
    code.includes(query)
  );
}
