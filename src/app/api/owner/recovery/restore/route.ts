import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSessionSecret,
  requireAdmin,
  verifyOwnerRecoveryKey,
} from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import {
  restoreFromSignedBackupBundle,
  restoreFromSnapshotId,
} from "@/lib/server/backup";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import {
  assertNotRateLimited,
  recordAuthFailure,
  resetRateLimit,
} from "@/lib/server/rate-limit";

const restoreRequestSchema = z
  .object({
    ownerRecoveryKey: z.string().trim().min(6, "กรุณากรอก Owner Recovery Key"),
    snapshotId: z.number().int().positive().optional(),
    backupBundle: z.unknown().optional(),
  })
  .refine((v) => v.snapshotId !== undefined || v.backupBundle !== undefined, {
    message: "กรุณาระบุ Snapshot ID หรือแนบไฟล์ Backup JSON",
  });

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = restoreRequestSchema.parse(await request.json());

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await assertNotRateLimited("owner_recovery", ipHash);

    if (!verifyOwnerRecoveryKey(parsed.ownerRecoveryKey)) {
      const failure = await recordAuthFailure("owner_recovery", ipHash);
      await writeAuditLog({
        actorName: admin.staffName,
        actorRole: "admin",
        action: "owner_recovery_failed",
        entityType: "system_backup",
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

    const outcome =
      parsed.snapshotId !== undefined
        ? await restoreFromSnapshotId(parsed.snapshotId, `Owner (${admin.staffName})`)
        : await restoreFromSignedBackupBundle(
            parsed.backupBundle,
            `Owner (${admin.staffName})`
          );

    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "owner",
      action: "system_restored",
      entityType: "system_backup",
      entityId: parsed.snapshotId ? String(parsed.snapshotId) : "uploaded_json",
      afterData: outcome,
      ipHash,
    });

    return NextResponse.json({
      ok: true,
      ...outcome,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
