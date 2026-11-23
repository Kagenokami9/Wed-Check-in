import type { Room, RoomDailyAttendance, Student } from "@/types/attendance";

export interface SaveRoomAttendanceInput {
  roomId: string;
  date: string;
  entries: Record<string, AttendanceEntryInput>;
  checkedBy: string;
  expectedVersion?: number | null;
  force?: boolean;
}

export interface AttendanceEntryInput {
  studentId: string;
  status: "present" | "absent" | "late" | "other";
  note?: string;
}

export interface AttendanceRepository {
  getRooms(): Promise<Room[]>;
  getRoomById(roomId: string): Promise<Room | null>;
  getRoomDetail(roomId: string): Promise<{
    room: Room | null;
    students: Student[];
    checkedDates: string[];
  }>;
  getStudentsByRoom(roomId: string): Promise<Student[]>;
  getAllStudents(): Promise<Student[]>;
  getRoomAttendance(roomId: string, date: string): Promise<RoomDailyAttendance | null>;
  getAttendanceByDate(date: string): Promise<RoomDailyAttendance[]>;
  getAllAttendance(): Promise<RoomDailyAttendance[]>;
  getCheckedDatesForRoom(roomId: string): Promise<string[]>;
  saveRoomAttendance(input: SaveRoomAttendanceInput): Promise<RoomDailyAttendance>;
  deleteRoomAttendance(roomId: string, date: string): Promise<void>;
  updateStudentNickname(studentId: string, nickname: string): Promise<void>;
}
