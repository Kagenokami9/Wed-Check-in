import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  canonicalJson,
  computeSha256,
  signBackupBundle,
  verifyBackupBundle,
  type SignedBackupBundle,
} from "@/lib/server/crypto";
import { getSessionSecret } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/http";

export type SnapshotReason = "manual" | "pre_delete" | "pre_restore" | "daily_auto" | "initial";

export interface SnapshotPayload {
  rooms: Record<string, unknown>[];
  students: Record<string, unknown>[];
  attendance_sessions: Record<string, unknown>[];
  attendance_entries: Record<string, unknown>[];
}

export interface SnapshotRecordSummary {
  id: number;
  reason: SnapshotReason;
  createdBy: string;
  checksumSha256: string;
  createdAt: string;
  counts: {
    rooms: number;
    students: number;
    sessions: number;
    entries: number;
  };
}

/**
 * Captures the complete domain dataset in parallel (eliminating sequential query waterfalls).
 */
export async function captureCurrentPayload(): Promise<SnapshotPayload> {
  const supabase = getSupabaseServerClient();

  const [roomsRes, studentsRes, sessionsRes, entriesRes] = await Promise.all([
    supabase.from("rooms").select("*").order("grade").order("room_number"),
    supabase.from("students").select("*").order("room_id").order("seat_number"),
    supabase.from("attendance_sessions").select("*").order("date", { ascending: false }),
    supabase.from("attendance_entries").select("*").order("session_id").order("student_id"),
  ]);

  if (roomsRes.error || studentsRes.error || sessionsRes.error || entriesRes.error) {
    throw new HttpError(500, "ไม่สามารถอ่านข้อมูลเพื่อสร้าง Snapshot ได้", "SNAPSHOT_READ_FAILED");
  }

  return {
    rooms: (roomsRes.data ?? []) as Record<string, unknown>[],
    students: (studentsRes.data ?? []) as Record<string, unknown>[],
    attendance_sessions: (sessionsRes.data ?? []) as Record<string, unknown>[],
    attendance_entries: (entriesRes.data ?? []) as Record<string, unknown>[],
  };
}

export async function createSystemSnapshot(
  reason: SnapshotReason,
  createdBy: string
): Promise<SnapshotRecordSummary> {
  const supabase = getSupabaseServerClient();
  const payload = await captureCurrentPayload();
  const checksumSha256 = computeSha256(canonicalJson(payload));

  const { data, error } = await supabase
    .from("system_snapshots")
    .insert({
      reason,
      created_by: createdBy,
      payload,
      checksum_sha256: checksumSha256,
    })
    .select("id, reason, created_by, checksum_sha256, created_at")
    .single();

  if (error || !data) {
    throw new HttpError(500, "ไม่สามารถบันทึก Snapshot ลงฐานข้อมูลได้", "SNAPSHOT_SAVE_FAILED");
  }

  return {
    id: Number(data.id),
    reason: data.reason as SnapshotReason,
    createdBy: data.created_by as string,
    checksumSha256: data.checksum_sha256 as string,
    createdAt: data.created_at as string,
    counts: {
      rooms: payload.rooms.length,
      students: payload.students.length,
      sessions: payload.attendance_sessions.length,
      entries: payload.attendance_entries.length,
    },
  };
}

export async function listSystemSnapshots(limit = 25): Promise<SnapshotRecordSummary[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("system_snapshots")
    .select("id, reason, created_by, checksum_sha256, created_at, payload")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new HttpError(500, "ไม่สามารถโหลดรายการ Snapshot ได้", "SNAPSHOT_LIST_FAILED");
  }

  return (data ?? []).map((row) => {
    const p = (row.payload ?? {}) as Partial<SnapshotPayload>;
    return {
      id: Number(row.id),
      reason: row.reason as SnapshotReason,
      createdBy: row.created_by as string,
      checksumSha256: row.checksum_sha256 as string,
      createdAt: row.created_at as string,
      counts: {
        rooms: Array.isArray(p.rooms) ? p.rooms.length : 0,
        students: Array.isArray(p.students) ? p.students.length : 0,
        sessions: Array.isArray(p.attendance_sessions) ? p.attendance_sessions.length : 0,
        entries: Array.isArray(p.attendance_entries) ? p.attendance_entries.length : 0,
      },
    };
  });
}

export async function exportSignedBackup(
  actorName: string
): Promise<SignedBackupBundle<SnapshotPayload>> {
  const payload = await captureCurrentPayload();
  return signBackupBundle(payload, actorName, getSessionSecret());
}

export async function restoreFromSnapshotId(
  snapshotId: number,
  actorName: string
): Promise<{
  preRestoreSnapshotId: number;
  restored: Record<string, number>;
}> {
  const supabase = getSupabaseServerClient();
  const { data: target, error } = await supabase
    .from("system_snapshots")
    .select("id, payload, checksum_sha256")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error || !target) {
    throw new HttpError(404, "ไม่พบ Snapshot ที่ต้องการกู้คืน", "SNAPSHOT_NOT_FOUND");
  }

  const actualChecksum = computeSha256(canonicalJson(target.payload));
  if (actualChecksum !== target.checksum_sha256) {
    throw new HttpError(422, "Checksum ของ Snapshot ไม่ถูกต้อง ไม่สามารถกู้คืนได้", "CHECKSUM_MISMATCH");
  }

  // Always capture a safety pre_restore snapshot BEFORE mutating state
  const preRestore = await createSystemSnapshot("pre_restore", actorName);

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "restore_system_snapshot_atomic",
    { p_payload: target.payload }
  );

  if (rpcError) {
    throw new HttpError(
      500,
      `การกู้คืนฐานข้อมูลล้มเหลว (ระบบ Rollback กลับสถานะเดิมแล้ว): ${rpcError.message}`,
      "RESTORE_FAILED"
    );
  }

  return {
    preRestoreSnapshotId: preRestore.id,
    restored: (rpcResult ?? {}) as Record<string, number>,
  };
}

export async function restoreFromSignedBackupBundle(
  rawBundle: unknown,
  actorName: string
): Promise<{
  preRestoreSnapshotId: number;
  restored: Record<string, number>;
}> {
  const verified = verifyBackupBundle<SnapshotPayload>(rawBundle, getSessionSecret());
  if (!verified.valid) {
    throw new HttpError(422, verified.error, "INVALID_BACKUP_BUNDLE");
  }

  const preRestore = await createSystemSnapshot("pre_restore", actorName);
  const supabase = getSupabaseServerClient();

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "restore_system_snapshot_atomic",
    { p_payload: verified.bundle.payload }
  );

  if (rpcError) {
    throw new HttpError(
      500,
      `การกู้คืนจากไฟล์ Backup ล้มเหลว (Rollback อัตโนมัติแล้ว): ${rpcError.message}`,
      "RESTORE_FAILED"
    );
  }

  return {
    preRestoreSnapshotId: preRestore.id,
    restored: (rpcResult ?? {}) as Record<string, number>,
  };
}
