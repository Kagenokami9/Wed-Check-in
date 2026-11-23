import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getSessionSecret,
  getValidatedSession,
} from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const existing = await getValidatedSession().catch(() => null);
    if (existing) {
      const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
      await writeAuditLog({
        actorName: existing.staffName,
        actorRole: existing.role,
        action: "auth_logout",
        entityType: "auth",
        ipHash,
      });
    }

    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
