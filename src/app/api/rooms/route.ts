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
      .from("rooms")
      .select("id, name, grade, room_number, program, homeroom_teachers")
      .is("deleted_at", null)
      .order("grade", { ascending: true })
      .order("room_number", { ascending: true });

    if (error) {
      throw new HttpError(500, "ไม่สามารถโหลดรายชื่อห้องเรียนได้", "ROOMS_LOAD_FAILED");
    }

    const rooms = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      grade: Number(row.grade),
      roomNumber: Number(row.room_number),
      program: (row.program as string) ?? "",
      homeroomTeachers: (row.homeroom_teachers as string) ?? "",
    }));

    return NextResponse.json({ rooms });
  } catch (error) {
    return handleApiError(error);
  }
}
