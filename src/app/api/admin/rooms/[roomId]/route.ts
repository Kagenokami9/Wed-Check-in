import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionSecret, requireAdmin } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { createSystemSnapshot } from "@/lib/server/backup";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const updateRoomSchema = z.object({
  program: z.string().trim().max(160).optional(),
  homeroomTeachers: z.string().trim().max(240).optional(),
  name: z.string().trim().min(1).max(32).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { roomId } = await context.params;
    const parsed = updateRoomSchema.parse(await request.json());

    const supabase = getSupabaseServerClient();
    const { data: existing, error: readErr } = await supabase
      .from("rooms")
      .select("id, name, grade, room_number, program, homeroom_teachers")
      .eq("id", roomId)
      .is("deleted_at", null)
      .maybeSingle();

    if (readErr) {
      throw new HttpError(500, "ไม่สามารถอ่านข้อมูลห้องเรียนได้", "ROOM_READ_FAILED");
    }
    if (!existing) {
      throw new HttpError(404, "ไม่พบห้องเรียนที่ต้องการแก้ไข", "ROOM_NOT_FOUND");
    }

    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.name !== undefined) updateFields.name = parsed.name;
    if (parsed.program !== undefined) updateFields.program = parsed.program;
    if (parsed.homeroomTeachers !== undefined) {
      updateFields.homeroom_teachers = parsed.homeroomTeachers;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("rooms")
      .update(updateFields)
      .eq("id", roomId)
      .select("id, name, grade, room_number, program, homeroom_teachers")
      .single();

    if (updateErr || !updated) {
      throw new HttpError(500, "ไม่สามารถแก้ไขข้อมูลห้องเรียนได้", "ROOM_UPDATE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: "room_updated",
      entityType: "room",
      entityId: roomId,
      beforeData: existing,
      afterData: updated,
      ipHash,
    });

    return NextResponse.json({
      room: {
        id: updated.id as string,
        name: updated.name as string,
        grade: Number(updated.grade),
        roomNumber: Number(updated.room_number),
        program: (updated.program as string) ?? "",
        homeroomTeachers: (updated.homeroom_teachers as string) ?? "",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { roomId } = await context.params;
    const supabase = getSupabaseServerClient();

    const { data: existing } = await supabase
      .from("rooms")
      .select("id, name, grade, room_number")
      .eq("id", roomId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!existing) {
      throw new HttpError(404, "ไม่พบห้องเรียนที่ต้องการลบ", "ROOM_NOT_FOUND");
    }

    await createSystemSnapshot("pre_delete", admin.staffName);

    const nowIso = new Date().toISOString();
    const { error: delErr } = await supabase
      .from("rooms")
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .eq("id", roomId);

    if (delErr) {
      throw new HttpError(500, "ไม่สามารถลบห้องเรียนได้", "ROOM_DELETE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: "room_deleted",
      entityType: "room",
      entityId: roomId,
      beforeData: existing,
      afterData: { deleted_at: nowIso },
      ipHash,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
