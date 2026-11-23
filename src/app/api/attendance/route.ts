import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get("date");

    if (dateFilter && !/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
      throw new HttpError(400, "รูปแบบวันที่ไม่ถูกต้อง", "INVALID_DATE");
    }

    const supabase = getSupabaseServerClient();

    let sessionQuery = supabase
      .from("attendance_sessions")
      .select("id, room_id, date, checked_by, version, updated_at")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("updated_at", { ascending: false });

    if (dateFilter) {
      sessionQuery = sessionQuery.eq("date", dateFilter);
    }

    const { data: sessionRows, error: sessionErr } = await sessionQuery;

    if (sessionErr) {
      throw new HttpError(500, "ไม่สามารถโหลดประวัติการเช็คชื่อได้", "ATTENDANCE_LIST_FAILED");
    }

    if (!sessionRows || sessionRows.length === 0) {
      return NextResponse.json({ records: [] });
    }

    const sessionIds = sessionRows.map((row) => row.id as string);
    const { data: entryRows, error: entriesErr } = await supabase
      .from("attendance_entries")
      .select("session_id, student_id, status, note")
      .in("session_id", sessionIds)
      .is("deleted_at", null);

    if (entriesErr) {
      throw new HttpError(500, "ไม่สามารถโหลดรายละเอียดการเช็คชื่อได้", "ENTRIES_LIST_FAILED");
    }

    const entriesBySession = new Map<
      string,
      Record<string, { studentId: string; status: "present" | "absent" | "late" | "other"; note?: string }>
    >();

    for (const row of entryRows ?? []) {
      const sid = row.session_id as string;
      const map = entriesBySession.get(sid) ?? {};
      const studentId = row.student_id as string;
      map[studentId] = {
        studentId,
        status: row.status as "present" | "absent" | "late" | "other",
        ...(row.note ? { note: row.note as string } : {}),
      };
      entriesBySession.set(sid, map);
    }

    const records = sessionRows.map((row) => ({
      id: row.id as string,
      roomId: row.room_id as string,
      date: String(row.date).slice(0, 10),
      entries: entriesBySession.get(row.id as string) ?? {},
      checkedBy: row.checked_by as string,
      version: Number(row.version),
      updatedAt: row.updated_at as string,
    }));

    return NextResponse.json({ records });
  } catch (error) {
    return handleApiError(error);
  }
}
