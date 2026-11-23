import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("students")
      .select(
        "id, student_code, room_id, seat_number, prefix, first_name, last_name, nickname, roster_note"
      )
      .is("deleted_at", null)
      .order("room_id", { ascending: true })
      .order("seat_number", { ascending: true });

    if (error) {
      throw new HttpError(500, "ไม่สามารถโหลดรายชื่อนักเรียนทั้งหมดได้", "STUDENTS_LOAD_FAILED");
    }

    const students = (data ?? []).map((s) => ({
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

    return NextResponse.json({ students });
  } catch (error) {
    return handleApiError(error);
  }
}
