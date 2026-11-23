import { NextResponse } from "next/server";
import { z } from "zod";
import {
  attachSessionCookie,
  getOrBootstrapSecurityConfig,
  getSessionSecret,
} from "@/lib/server/auth";
import { hashClientIp, verifySecret, type SessionRole } from "@/lib/server/crypto";
import { writeAuditLog } from "@/lib/server/audit";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import {
  assertNotRateLimited,
  recordAuthFailure,
  resetRateLimit,
} from "@/lib/server/rate-limit";

const loginSchema = z.object({
  staffName: z
    .string()
    .trim()
    .min(1, "กรุณากรอกหรือเลือกชื่อสตาฟก่อนเข้าสู่ระบบ")
    .max(80, "ชื่อสตาฟต้องไม่เกิน 80 ตัวอักษร"),
  pin: z.string().trim().regex(/^\d{6}$/, "รหัส PIN ต้องเป็นตัวเลข 6 หลัก"),
  expectedRole: z.enum(["member", "admin"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { staffName, pin, expectedRole } = loginSchema.parse(body);

    const sessionSecret = getSessionSecret();
    const ipHash = hashClientIp(getClientIp(request), sessionSecret);

    // 1. Check persistent brute-force lockout BEFORE doing scrypt work
    await assertNotRateLimited("login", ipHash);

    // 2. Load salted hashes and compare against BOTH roles in constant time
    const config = await getOrBootstrapSecurityConfig();
    const matchesAdmin = verifySecret(pin, config.admin_pin_hash);
    const matchesStaff = verifySecret(pin, config.staff_pin_hash);

    let matchedRole: SessionRole | null = null;
    if (matchesAdmin) {
      matchedRole = "admin";
    } else if (matchesStaff) {
      matchedRole = "member";
    }

    if (!matchedRole) {
      const failure = await recordAuthFailure("login", ipHash);
      await writeAuditLog({
        actorName: staffName,
        actorRole: "anonymous",
        action: failure.locked ? "auth_locked" : "auth_failed",
        entityType: "auth",
        afterData: {
          locked: failure.locked,
          remainingAttempts: failure.remainingAttempts,
        },
        ipHash,
      });

      if (failure.locked) {
        const minutes = Math.ceil((failure.retryAfterSeconds ?? 900) / 60);
        throw new HttpError(
          429,
          `กรอก PIN ผิดครบกำหนด ระบบล็อกชั่วคราว ${minutes} นาที`,
          "RATE_LIMITED",
          {
            retryAfterSeconds: failure.retryAfterSeconds,
            lockedUntil: failure.lockedUntil,
          }
        );
      }

      throw new HttpError(
        401,
        `รหัส PIN 6 หลักไม่ถูกต้อง (เหลือโอกาสอีก ${failure.remainingAttempts} ครั้ง)`,
        "INVALID_PIN",
        { remainingAttempts: failure.remainingAttempts }
      );
    }

    // 3. Enforce selected login role mode when explicitly chosen on /login
    if (expectedRole && matchedRole !== expectedRole) {
      if (expectedRole === "admin") {
        throw new HttpError(
          403,
          "รหัสนี้เป็นของ สตาฟทั่วไป (Member) ไม่ใช่รหัสผู้ดูแลระบบ (Admin) — กรุณาสลับไปแท็บสตาฟหรือกรอก Admin PIN",
          "ROLE_MISMATCH",
          { actualRole: matchedRole }
        );
      }
      throw new HttpError(
        403,
        "รหัสนี้เป็นของ ผู้ดูแลระบบ (Admin) — กรุณาสลับไปแท็บผู้ดูแลระบบเพื่อเข้าสู่ระบบด้วยสิทธิ์ Admin",
        "ROLE_MISMATCH",
        { actualRole: matchedRole }
      );
    }

    // 4. Reset rate limit & issue signed HttpOnly session cookie
    await resetRateLimit("login", ipHash);

    const sessionVersion =
      matchedRole === "admin"
        ? Number(config.admin_session_version)
        : Number(config.staff_session_version);

    await writeAuditLog({
      actorName: staffName,
      actorRole: matchedRole,
      action: "auth_login",
      entityType: "auth",
      afterData: { role: matchedRole },
      ipHash,
    });

    const response = NextResponse.json({
      session: {
        staffName,
        role: matchedRole,
        loggedInAt: new Date().toISOString(),
      },
    });

    attachSessionCookie(response, {
      staffName,
      role: matchedRole,
      sessionVersion,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
