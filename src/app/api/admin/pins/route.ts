import { NextResponse } from "next/server";
import { z } from "zod";
import {
  attachSessionCookie,
  getOrBootstrapSecurityConfig,
  getSessionSecret,
  requireAdmin,
} from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { hashClientIp, hashSecret, verifySecret } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const changePinSchema = z.object({
  targetRole: z.enum(["member", "admin"]),
  currentAdminPin: z.string().trim().regex(/^\d{6}$/, "กรุณากรอกรหัส Admin PIN ปัจจุบัน 6 หลัก"),
  newPin: z.string().trim().regex(/^\d{6}$/, "รหัส PIN ใหม่ต้องเป็นตัวเลข 6 หลัก"),
});

export async function GET() {
  try {
    await requireAdmin();
    const config = await getOrBootstrapSecurityConfig();
    return NextResponse.json({
      staffSessionVersion: Number(config.staff_session_version),
      adminSessionVersion: Number(config.admin_session_version),
      updatedAt: config.updated_at,
      updatedBy: config.updated_by,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { targetRole, currentAdminPin, newPin } = changePinSchema.parse(
      await request.json()
    );

    const config = await getOrBootstrapSecurityConfig();
    if (!verifySecret(currentAdminPin, config.admin_pin_hash)) {
      throw new HttpError(403, "รหัส Admin PIN ปัจจุบันไม่ถูกต้อง", "INVALID_ADMIN_PIN");
    }

    // Ensure Member PIN and Admin PIN never collide
    const otherHash =
      targetRole === "admin" ? config.staff_pin_hash : config.admin_pin_hash;
    if (verifySecret(newPin, otherHash)) {
      throw new HttpError(
        400,
        "รหัส PIN ของสตาฟและผู้ดูแลระบบห้ามซ้ำกัน กรุณาตั้งเลขอื่น",
        "PIN_COLLISION"
      );
    }

    const newHash = hashSecret(newPin);
    const nowIso = new Date().toISOString();
    const nextStaffVersion =
      targetRole === "member"
        ? Number(config.staff_session_version) + 1
        : Number(config.staff_session_version);
    const nextAdminVersion =
      targetRole === "admin"
        ? Number(config.admin_session_version) + 1
        : Number(config.admin_session_version);

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("app_security_config")
      .update({
        ...(targetRole === "member"
          ? { staff_pin_hash: newHash, staff_session_version: nextStaffVersion }
          : { admin_pin_hash: newHash, admin_session_version: nextAdminVersion }),
        updated_at: nowIso,
        updated_by: admin.staffName,
      })
      .eq("id", 1);

    if (error) {
      throw new HttpError(500, "ไม่สามารถบันทึกรหัส PIN ใหม่ได้", "PIN_UPDATE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: targetRole === "admin" ? "admin_pin_changed" : "staff_pin_changed",
      entityType: "security_config",
      entityId: "1",
      afterData: {
        targetRole,
        newSessionVersion: targetRole === "admin" ? nextAdminVersion : nextStaffVersion,
      },
      ipHash,
    });

    const response = NextResponse.json({
      ok: true,
      targetRole,
      sessionsRevoked: true,
      staffSessionVersion: nextStaffVersion,
      adminSessionVersion: nextAdminVersion,
      updatedAt: nowIso,
      updatedBy: admin.staffName,
    });

    // Keep the current admin's own session valid if they rotated the admin PIN
    if (targetRole === "admin") {
      attachSessionCookie(response, {
        staffName: admin.staffName,
        role: "admin",
        sessionVersion: nextAdminVersion,
      });
    }

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
