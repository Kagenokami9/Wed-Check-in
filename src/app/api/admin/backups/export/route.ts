import { NextResponse } from "next/server";
import { getSessionSecret, requireAdmin } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { exportSignedBackup } from "@/lib/server/backup";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const bundle = await exportSignedBackup(admin.staffName);

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: "backup_exported",
      entityType: "system_backup",
      afterData: {
        checksumSha256: bundle.checksumSha256,
        rooms: bundle.payload.rooms.length,
        students: bundle.payload.students.length,
        sessions: bundle.payload.attendance_sessions.length,
      },
      ipHash,
    });

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="blue-checkin-backup-${today}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
