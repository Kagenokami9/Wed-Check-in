import { ApiAttendanceRepository } from "./api-repository";
import type { AttendanceRepository } from "./types";

/**
 * Single data-access export backed by Next.js BFF Route Handlers + Supabase PostgreSQL.
 * Fail-closed: no silent fallback to localStorage.
 */
export const attendanceRepository: AttendanceRepository = new ApiAttendanceRepository();

export type { AttendanceRepository, SaveRoomAttendanceInput } from "./types";
export {
  ApiClientError,
  AttendanceConflictError,
  DATA_CHANGED_EVENT,
} from "./api-repository";
