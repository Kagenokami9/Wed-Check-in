import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient, ServerConfigError } from "@/lib/supabase/server";
import {
  hashSecret,
  signSessionToken,
  verifySecret,
  verifySessionToken,
  type SessionRole,
} from "@/lib/server/crypto";
import { HttpError } from "@/lib/server/http";

export const SESSION_COOKIE_NAME = "blue_checkin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export interface AuthenticatedStaff {
  staffName: string;
  role: SessionRole;
  sessionVersion: number;
}

export interface SecurityConfigRow {
  id: number;
  staff_pin_hash: string;
  admin_pin_hash: string;
  staff_session_version: number;
  admin_session_version: number;
  updated_at: string;
  updated_by: string;
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32 || secret.includes("replace_with")) {
    throw new ServerConfigError(
      "ยังไม่ได้ตั้งค่า SESSION_SECRET ฝั่งเซิร์ฟเวอร์ (ต้องยาวอย่างน้อย 32 ตัวอักษร)"
    );
  }
  return secret;
}

export function getOwnerRecoveryKeyHash(): string {
  const hash = process.env.OWNER_RECOVERY_KEY_HASH?.trim();
  if (!hash || !hash.startsWith("scrypt$") || hash.includes("replace_")) {
    throw new ServerConfigError(
      "ยังไม่ได้ตั้งค่า OWNER_RECOVERY_KEY_HASH ฝั่งเซิร์ฟเวอร์"
    );
  }
  return hash;
}

/**
 * Loads `app_security_config` (row id=1). If not bootstrapped yet, hashes
 * INITIAL_STAFF_PIN and INITIAL_ADMIN_PIN with salted scrypt and inserts atomically.
 */
export async function getOrBootstrapSecurityConfig(): Promise<SecurityConfigRow> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("app_security_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle<SecurityConfigRow>();

  if (error) {
    throw new HttpError(503, "ไม่สามารถอ่านค่าความปลอดภัยจากฐานข้อมูลได้", "DB_ERROR");
  }

  if (data) return data;

  const initialStaffPin = process.env.INITIAL_STAFF_PIN?.trim() || "256900";
  const initialAdminPin = process.env.INITIAL_ADMIN_PIN?.trim() || "996900";

  if (!/^\d{6}$/.test(initialStaffPin) || !/^\d{6}$/.test(initialAdminPin)) {
    throw new ServerConfigError("INITIAL_STAFF_PIN และ INITIAL_ADMIN_PIN ต้องเป็นตัวเลข 6 หลัก");
  }
  if (initialStaffPin === initialAdminPin) {
    throw new ServerConfigError("INITIAL_STAFF_PIN และ INITIAL_ADMIN_PIN ห้ามซ้ำกัน");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("app_security_config")
    .upsert(
      {
        id: 1,
        staff_pin_hash: hashSecret(initialStaffPin),
        admin_pin_hash: hashSecret(initialAdminPin),
        staff_session_version: 1,
        admin_session_version: 1,
        updated_by: "bootstrap",
      },
      { onConflict: "id", ignoreDuplicates: true }
    )
    .select("*")
    .maybeSingle<SecurityConfigRow>();

  if (insertError) {
    throw new HttpError(503, "ไม่สามารถตั้งค่า PIN เริ่มต้นได้", "BOOTSTRAP_FAILED");
  }

  if (inserted) return inserted;

  const { data: refetched } = await supabase
    .from("app_security_config")
    .select("*")
    .eq("id", 1)
    .single<SecurityConfigRow>();

  if (!refetched) {
    throw new HttpError(503, "ไม่พบค่าความปลอดภัยในฐานข้อมูล", "BOOTSTRAP_MISSING");
  }
  return refetched;
}

export function attachSessionCookie(
  response: NextResponse,
  session: AuthenticatedStaff
): void {
  const token = signSessionToken(session, getSessionSecret());
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Validates the HttpOnly signed session cookie AND verifies its sessionVersion
 * against PostgreSQL so PIN rotations immediately invalidate old sessions.
 */
export async function getValidatedSession(): Promise<AuthenticatedStaff | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const payload = verifySessionToken(rawToken, getSessionSecret());
  if (!payload) return null;

  const config = await getOrBootstrapSecurityConfig();
  const expectedVersion =
    payload.role === "admin"
      ? Number(config.admin_session_version)
      : Number(config.staff_session_version);

  if (payload.sessionVersion !== expectedVersion) {
    return null;
  }

  return {
    staffName: payload.staffName,
    role: payload.role,
    sessionVersion: payload.sessionVersion,
  };
}

export async function requireAuth(): Promise<AuthenticatedStaff> {
  const session = await getValidatedSession();
  if (!session) {
    throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่อีกครั้ง (เซสชันหมดอายุหรือรหัสถูกเปลี่ยน)", "UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin(): Promise<AuthenticatedStaff> {
  const session = await requireAuth();
  if (session.role !== "admin") {
    throw new HttpError(403, "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถดำเนินการนี้ได้", "FORBIDDEN");
  }
  return session;
}

export function verifyOwnerRecoveryKey(candidateKey: string): boolean {
  const expectedHash = getOwnerRecoveryKeyHash();
  return verifySecret(candidateKey.trim(), expectedHash);
}
