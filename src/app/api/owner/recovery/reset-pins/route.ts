import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearSessionCookie,
  getOrBootstrapSecurityConfig,
  getSessionSecret,
  verifyOwnerRecoveryKey,
} from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { hashClientIp, hashSecret } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import {
  assertNotRateLimited,
  recordAuthFailure,
  resetRateLimit,
} from "@/lib/server/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const emergencyResetSchema = z
  .object({
    ownerRecoveryKey: z.string().trim().min(6, "กรุณากรอก Owner Recovery Key"),
    newStaffPin: z.string().trim().regex(/^\d{6}$/, "Staff PIN ใหม่ต้องเป็นตัวเลข 6 หลัก"),
    newAdminPin: z.string().trim().regex(/^\d{6}$/, "Admin PIN ใหม่ต้องเป็นตัวเลข 6 หลัก"),
  })
  .refine((v) => v.newStaffPin !== v.newAdminPin, {
    message: "Staff PIN และ Admin PIN ห้ามซ้ำกัน",
  });

/**
 * Owner-only Emergency PIN Reset.
 * Callable even if Admin PIN was lost or altered without authorization.
 * Protected by strict persistent rate limit (3 attempts / hour) & scrypt Owner Recovery Key.
 */
export async function POST(request: Request) {
  try {
    const parsed = emergencyResetSchema.parse(await request.json());

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await assertNotRateLimited("owner_recovery", ipHash);

    if (!verifyOwnerRecoveryKey(parsed.ownerRecoveryKey)) {
      const failure = await recordAuthFailure("owner_recovery", ipHash);
      await writeAuditLog({
        actorName: "owner_recovery_attempt",
        actorRole: "anonymous",
        action: "owner_emergency_reset_failed",
        entityType: "security_config",
        afterData: { locked: failure.locked, remainingAttempts: failure.remainingAttempts },
        ipHash,
      });

      if (failure.locked) {
        throw new HttpError(
          429,
          "กรอก Owner Recovery Key ผิดเกินกำหนด ถูกล็อกชั่วคราว 60 นาที",
          "RATE_LIMITED",
          { retryAfterSeconds: failure.retryAfterSeconds }
        );
      }

      throw new HttpError(
        403,
        `Owner Recovery Key ไม่ถูกต้อง (เหลือโอกาสอีก ${failure.remainingAttempts} ครั้ง)`,
        "INVALID_OWNER_KEY"
      );
    }

    await resetRateLimit("owner_recovery", ipHash);

    const config = await getOrBootstrapSecurityConfig();
    const nextStaffVersion = Number(config.staff_session_version) + 1;
    const nextAdminVersion = Number(config.admin_session_version) + 1;

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("app_security_config")
      .update({
        staff_pin_hash: hashSecret(parsed.newStaffPin),
        admin_pin_hash: hashSecret(parsed.newAdminPin),
        staff_session_version: nextStaffVersion,
        admin_session_version: nextAdminVersion,
        updated_at: new Date().toISOString(),
        updated_by: "owner_emergency_reset",
      })
      .eq("id", 1);

    if (error) {
      throw new HttpError(500, "ไม่สามารถรีเซ็ตรหัส PIN ได้", "EMERGENCY_RESET_FAILED");
    }

    await writeAuditLog({
      actorName: "Owner Recovery",
      actorRole: "owner",
      action: "owner_emergency_pin_reset",
      entityType: "security_config",
      entityId: "1",
      afterData: {
        staffSessionVersion: nextStaffVersion,
        adminSessionVersion: nextAdminVersion,
      },
      ipHash,
    });

    const response = NextResponse.json({
      ok: true,
      message: "รีเซ็ตรหัส PIN ทั้งหมดและยกเลิกเซสชันเก่าเรียบร้อยแล้ว",
    });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
