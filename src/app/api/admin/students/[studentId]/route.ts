import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionSecret, requireAdmin } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const updateStudentSchema = z.object({
  studentCode: z.string().trim().min(1).max(32).optional(),
  roomId: z.string().trim().min(1).optional(),
  seatNumber: z.number().int().min(1).max(200).optional(),
  prefix: z.string().trim().max(32).optional(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  nickname: z.string().trim().max(24).nullable().optional(),
  rosterNote: z.string().trim().max(160).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { studentId } = await context.params;
    const parsed = updateStudentSchema.parse(await request.json());

    const supabase = getSupabaseServerClient();
    const { data: existing } = await supabase
      .from("students")
      .select(
        "id, student_code, room_id, seat_number, prefix, first_name, last_name, nickname, roster_note"
      )
      .eq("id", studentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!existing) {
      throw new HttpError(404, "ไม่พบนักเรียนที่ต้องการแก้ไข", "STUDENT_NOT_FOUND");
    }

    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.studentCode !== undefined) updateFields.student_code = parsed.studentCode;
    if (parsed.roomId !== undefined) updateFields.room_id = parsed.roomId;
    if (parsed.seatNumber !== undefined) updateFields.seat_number = parsed.seatNumber;
    if (parsed.prefix !== undefined) updateFields.prefix = parsed.prefix;
    if (parsed.firstName !== undefined) updateFields.first_name = parsed.firstName;
    if (parsed.lastName !== undefined) updateFields.last_name = parsed.lastName;
    if (parsed.nickname !== undefined) updateFields.nickname = parsed.nickname || null;
    if (parsed.rosterNote !== undefined) updateFields.roster_note = parsed.rosterNote || null;

    const { data: updated, error: updateErr } = await supabase
      .from("students")
      .update(updateFields)
      .eq("id", studentId)
      .select(
        "id, student_code, room_id, seat_number, prefix, first_name, last_name, nickname, roster_note"
      )
      .single();

    if (updateErr || !updated) {
      throw new HttpError(500, "ไม่สามารถแก้ไขข้อมูลนักเรียนได้", "STUDENT_UPDATE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: "student_updated",
      entityType: "student",
      entityId: studentId,
      beforeData: existing,
      afterData: updated,
      ipHash,
    });

    return NextResponse.json({
      student: {
        id: updated.id as string,
        studentCode: updated.student_code as string,
        roomId: updated.room_id as string,
        seatNumber: Number(updated.seat_number),
        prefix: (updated.prefix as string) ?? "",
        firstName: updated.first_name as string,
        lastName: (updated.last_name as string) ?? "",
        ...(updated.nickname ? { nickname: updated.nickname as string } : {}),
        ...(updated.roster_note ? { rosterNote: updated.roster_note as string } : {}),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { studentId } = await context.params;
    const supabase = getSupabaseServerClient();

    const { data: existing } = await supabase
      .from("students")
      .select("id, room_id, seat_number, first_name, last_name")
      .eq("id", studentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!existing) {
      throw new HttpError(404, "ไม่พบนักเรียนที่ต้องการลบ", "STUDENT_NOT_FOUND");
    }

    const nowIso = new Date().toISOString();
    const { error: delErr } = await supabase
      .from("students")
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .eq("id", studentId);

    if (delErr) {
      throw new HttpError(500, "ไม่สามารถลบนักเรียนได้", "STUDENT_DELETE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: "student_deleted",
      entityType: "student",
      entityId: studentId,
      beforeData: existing,
      afterData: { deleted_at: nowIso },
      ipHash,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
