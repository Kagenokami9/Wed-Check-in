import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionSecret, requireAuth } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const nicknameSchema = z.object({
  nickname: z.string().trim().max(24, "ชื่อเล่นต้องไม่เกิน 24 ตัวอักษร"),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const staff = await requireAuth();
    const { studentId } = await context.params;
    const { nickname } = nicknameSchema.parse(await request.json());

    const supabase = getSupabaseServerClient();

    const { data: existing, error: readErr } = await supabase
      .from("students")
      .select("id, first_name, last_name, nickname")
      .eq("id", studentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (readErr) {
      throw new HttpError(500, "ไม่สามารถค้นหาข้อมูลนักเรียนได้", "STUDENT_READ_FAILED");
    }
    if (!existing) {
      throw new HttpError(404, "ไม่พบข้อมูลนักเรียนนี้", "STUDENT_NOT_FOUND");
    }

    const nextNickname = nickname || null;
    const { error: updateErr } = await supabase
      .from("students")
      .update({
        nickname: nextNickname,
        updated_at: new Date().toISOString(),
      })
      .eq("id", studentId);

    if (updateErr) {
      throw new HttpError(500, "ไม่สามารถบันทึกชื่อเล่นได้", "NICKNAME_UPDATE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: staff.staffName,
      actorRole: staff.role,
      action: "nickname_updated",
      entityType: "student",
      entityId: studentId,
      beforeData: { nickname: existing.nickname ?? null },
      afterData: { nickname: nextNickname },
      ipHash,
    });

    return NextResponse.json({
      studentId,
      nickname: nextNickname ?? "",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
