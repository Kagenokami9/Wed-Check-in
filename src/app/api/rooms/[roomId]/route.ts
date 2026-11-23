import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    await requireAuth();
    const { roomId } = await context.params;
    const supabase = getSupabaseServerClient();

    // Start independent queries in parallel (zero async waterfalls)
    const [roomRes, studentsRes, datesRes] = await Promise.all([
      supabase
        .from("rooms")
        .select("id, name, grade, room_number, program, homeroom_teachers")
        .eq("id", roomId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("students")
        .select(
          "id, student_code, room_id, seat_number, prefix, first_name, last_name, nickname, roster_note"
        )
        .eq("room_id", roomId)
        .is("deleted_at", null)
        .order("seat_number", { ascending: true }),
      supabase
        .from("attendance_sessions")
        .select("date")
        .eq("room_id", roomId)
        .is("deleted_at", null)
        .order("date", { ascending: true }),
    ]);

    if (roomRes.error) {
      throw new HttpError(500, "ไม่สามารถโหลดข้อมูลห้องเรียนได้", "ROOM_LOAD_FAILED");
    }

    if (!roomRes.data) {
      return NextResponse.json({ room: null, students: [], checkedDates: [] }, { status: 404 });
    }

    if (studentsRes.error || datesRes.error) {
      throw new HttpError(500, "ไม่สามารถโหลดรายชื่อนักเรียนในห้องได้", "STUDENTS_LOAD_FAILED");
    }

    const room = {
      id: roomRes.data.id as string,
      name: roomRes.data.name as string,
      grade: Number(roomRes.data.grade),
      roomNumber: Number(roomRes.data.room_number),
      program: (roomRes.data.program as string) ?? "",
      homeroomTeachers: (roomRes.data.homeroom_teachers as string) ?? "",
    };

    const students = (studentsRes.data ?? []).map((s) => ({
      id: s.id as string,
      studentCode: s.student_code as string,
      roomId: s.room_id as string,
      seatNumber: Number(s.seat_number),
      prefix: (s.prefix as string) ?? "",
      firstName: s.first_name as string,
      lastName: (s.last_name as string) ?? "",
      ...(s.nickname ? { nickname: s.nickname as string } : {}),
      ...(s.roster_note ? { rosterNote: s.roster_note as string } : {}),
    }));

    const checkedDates = (datesRes.data ?? []).map((d) => String(d.date).slice(0, 10));

    return NextResponse.json({ room, students, checkedDates });
  } catch (error) {
    return handleApiError(error);
  }
}
