import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionSecret, requireAdmin } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const restoreItemSchema = z.object({
  entityType: z.enum(["room", "student", "attendance_session"]),
  entityId: z.string().trim().min(1),
});

const TABLE_BY_ENTITY = {
  room: "rooms",
  student: "students",
  attendance_session: "attendance_sessions",
} as const;

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { entityType, entityId } = restoreItemSchema.parse(await request.json());

    const table = TABLE_BY_ENTITY[entityType];
    const supabase = getSupabaseServerClient();

    const { data: existing } = await supabase
      .from(table)
      .select("id, deleted_at")
      .eq("id", entityId)
      .maybeSingle();

    if (!existing) {
      throw new HttpError(404, "ไม่พบรายการที่ต้องการกู้คืน", "ITEM_NOT_FOUND");
    }

    const { error } = await supabase
      .from(table)
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", entityId);

    if (error) {
      throw new HttpError(500, "ไม่สามารถกู้คืนรายการได้", "ITEM_RESTORE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: `${entityType}_restored`,
      entityType,
      entityId,
      beforeData: { deleted_at: existing.deleted_at },
      afterData: { deleted_at: null },
      ipHash,
    });

    return NextResponse.json({ ok: true, entityType, entityId });
  } catch (error) {
    return handleApiError(error);
  }
}
