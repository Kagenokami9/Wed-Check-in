import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionSecret, requireAdmin } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createRoomSchema = z.object({
  grade: z.number().int().min(1).max(12),
  roomNumber: z.number().int().min(1).max(99),
  program: z.string().trim().max(160).default(""),
  homeroomTeachers: z.string().trim().max(240).default(""),
});

export async function GET() {
  try {
    await requireAdmin();
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, grade, room_number, program, homeroom_teachers, deleted_at, updated_at")
      .order("grade", { ascending: true })
      .order("room_number", { ascending: true });

    if (error) {
      throw new HttpError(500, "ไม่สามารถโหลดรายการห้องเรียนได้", "ADMIN_ROOMS_LOAD_FAILED");
    }

    const rooms = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      grade: Number(row.grade),
      roomNumber: Number(row.room_number),
      program: (row.program as string) ?? "",
      homeroomTeachers: (row.homeroom_teachers as string) ?? "",
      deletedAt: (row.deleted_at as string | null) ?? null,
      updatedAt: row.updated_at as string,
    }));

    return NextResponse.json({ rooms });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = createRoomSchema.parse(await request.json());

    const id = `m${parsed.grade}-${parsed.roomNumber}`;
    const name = `ม.${parsed.grade}/${parsed.roomNumber}`;
    const supabase = getSupabaseServerClient();

    const { data: existing } = await supabase
      .from("rooms")
      .select("id, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (existing && !existing.deleted_at) {
      throw new HttpError(409, `มีห้องเรียน ${name} อยู่ในระบบแล้ว`, "ROOM_ALREADY_EXISTS");
    }

    const nowIso = new Date().toISOString();
    const nextRow = {
      id,
      name,
      grade: parsed.grade,
      room_number: parsed.roomNumber,
      program: parsed.program,
      homeroom_teachers: parsed.homeroomTeachers,
      updated_at: nowIso,
      deleted_at: null,
    };

    const { data, error } = await supabase
      .from("rooms")
      .upsert(nextRow, { onConflict: "id" })
      .select("id, name, grade, room_number, program, homeroom_teachers")
      .single();

    if (error || !data) {
      throw new HttpError(500, "ไม่สามารถสร้างห้องเรียนได้", "ROOM_CREATE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: existing ? "room_restored_and_updated" : "room_created",
      entityType: "room",
      entityId: id,
      afterData: data,
      ipHash,
    });

    return NextResponse.json(
      {
        room: {
          id: data.id as string,
          name: data.name as string,
          grade: Number(data.grade),
          roomNumber: Number(data.room_number),
          program: (data.program as string) ?? "",
          homeroomTeachers: (data.homeroom_teachers as string) ?? "",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
