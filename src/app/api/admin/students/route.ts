import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionSecret, requireAdmin } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createStudentSchema = z.object({
  studentCode: z.string().trim().min(1, "กรุณากรอกรหัสนักเรียน").max(32),
  roomId: z.string().trim().min(1, "กรุณาเลือกห้องเรียน"),
  seatNumber: z.number().int().min(1).max(200),
  prefix: z.string().trim().max(32).default(""),
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อนักเรียน").max(80),
  lastName: z.string().trim().max(80).default(""),
  nickname: z.string().trim().max(24).optional(),
  rosterNote: z.string().trim().max(160).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("students")
      .select(
        "id, student_code, room_id, seat_number, prefix, first_name, last_name, nickname, roster_note, deleted_at, updated_at"
      )
      .order("room_id", { ascending: true })
      .order("seat_number", { ascending: true });

    if (roomId) {
      query = query.eq("room_id", roomId);
    }

    const { data, error } = await query;
    if (error) {
      throw new HttpError(500, "ไม่สามารถโหลดรายชื่อนักเรียนได้", "ADMIN_STUDENTS_LOAD_FAILED");
    }

    const students = (data ?? []).map((s) => ({
      id: s.id as string,
      studentCode: s.student_code as string,
      roomId: s.room_id as string,
      seatNumber: Number(s.seat_number),
      prefix: (s.prefix as string) ?? "",
      firstName: s.first_name as string,
      lastName: (s.last_name as string) ?? "",
      nickname: (s.nickname as string | null) ?? undefined,
      rosterNote: (s.roster_note as string | null) ?? undefined,
      deletedAt: (s.deleted_at as string | null) ?? null,
      updatedAt: s.updated_at as string,
    }));

    return NextResponse.json({ students });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = createStudentSchema.parse(await request.json());

    const supabase = getSupabaseServerClient();
    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", parsed.roomId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!room) {
      throw new HttpError(404, "ไม่พบห้องเรียนที่เลือก", "ROOM_NOT_FOUND");
    }

    let id = parsed.studentCode;
    const { data: existing } = await supabase
      .from("students")
      .select("id, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (existing && !existing.deleted_at) {
      id = `${parsed.roomId}-${parsed.seatNumber}-${parsed.studentCode}`;
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("students")
      .upsert(
        {
          id,
          student_code: parsed.studentCode,
          room_id: parsed.roomId,
          seat_number: parsed.seatNumber,
          prefix: parsed.prefix,
          first_name: parsed.firstName,
          last_name: parsed.lastName,
          nickname: parsed.nickname || null,
          roster_note: parsed.rosterNote || null,
          updated_at: nowIso,
          deleted_at: null,
        },
        { onConflict: "id" }
      )
      .select(
        "id, student_code, room_id, seat_number, prefix, first_name, last_name, nickname, roster_note"
      )
      .single();

    if (error || !data) {
      throw new HttpError(500, "ไม่สามารถเพิ่มรายชื่อนักเรียนได้", "STUDENT_CREATE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: "student_created",
      entityType: "student",
      entityId: data.id as string,
      afterData: data,
      ipHash,
    });

    return NextResponse.json(
      {
        student: {
          id: data.id as string,
          studentCode: data.student_code as string,
          roomId: data.room_id as string,
          seatNumber: Number(data.seat_number),
          prefix: (data.prefix as string) ?? "",
          firstName: data.first_name as string,
          lastName: (data.last_name as string) ?? "",
          ...(data.nickname ? { nickname: data.nickname as string } : {}),
          ...(data.roster_note ? { rosterNote: data.roster_note as string } : {}),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
