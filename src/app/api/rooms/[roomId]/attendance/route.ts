import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionSecret, requireAdmin, requireAuth } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { createSystemSnapshot } from "@/lib/server/backup";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)");

const entrySchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "other"]),
  note: z.string().max(240).optional(),
});

const saveAttendanceSchema = z.object({
  date: dateKeySchema,
  entries: z.record(z.string(), entrySchema),
  expectedVersion: z.number().int().positive().nullable().optional(),
  force: z.boolean().optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    await requireAuth();
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const date = dateKeySchema.parse(searchParams.get("date") ?? "");

    const supabase = getSupabaseServerClient();
    const sessionId = `${roomId}_${date}`;

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("attendance_sessions")
      .select("id, room_id, date, checked_by, version, updated_at")
      .eq("id", sessionId)
      .is("deleted_at", null)
      .maybeSingle();

    if (sessionErr) {
      throw new HttpError(500, "ไม่สามารถโหลดข้อมูลเช็คชื่อได้", "ATTENDANCE_LOAD_FAILED");
    }

    if (!sessionRow) {
      return NextResponse.json({ record: null });
    }

    const { data: entryRows, error: entriesErr } = await supabase
      .from("attendance_entries")
      .select("student_id, status, note")
      .eq("session_id", sessionId)
      .is("deleted_at", null);

    if (entriesErr) {
      throw new HttpError(500, "ไม่สามารถโหลดสถานะนักเรียนได้", "ENTRIES_LOAD_FAILED");
    }

    const entries: Record<
      string,
      { studentId: string; status: "present" | "absent" | "late" | "other"; note?: string }
    > = {};

    for (const row of entryRows ?? []) {
      const studentId = row.student_id as string;
      entries[studentId] = {
        studentId,
        status: row.status as "present" | "absent" | "late" | "other",
        ...(row.note ? { note: row.note as string } : {}),
      };
    }

    return NextResponse.json({
      record: {
        id: sessionRow.id as string,
        roomId: sessionRow.room_id as string,
        date: String(sessionRow.date).slice(0, 10),
        entries,
        checkedBy: sessionRow.checked_by as string,
        version: Number(sessionRow.version),
        updatedAt: sessionRow.updated_at as string,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const staff = await requireAuth();
    const { roomId } = await context.params;
    const parsed = saveAttendanceSchema.parse(await request.json());

    const entriesArray = Object.values(parsed.entries).map((entry) => ({
      studentId: entry.studentId,
      status: entry.status,
      note: entry.status === "other" ? entry.note?.trim() ?? "" : "",
    }));

    const supabase = getSupabaseServerClient();
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "save_room_attendance_atomic",
      {
        p_room_id: roomId,
        p_date: parsed.date,
        p_checked_by: staff.staffName,
        p_expected_version: parsed.expectedVersion ?? null,
        p_force: Boolean(parsed.force),
        p_entries: entriesArray,
      }
    );

    if (rpcError) {
      if (rpcError.message.includes("ROOM_NOT_FOUND")) {
        throw new HttpError(404, "ไม่พบห้องเรียนนี้ในระบบ", "ROOM_NOT_FOUND");
      }
      throw new HttpError(500, "ไม่สามารถบันทึกการเช็คชื่อได้", "ATTENDANCE_SAVE_FAILED");
    }

    const result = rpcData as {
      conflict?: boolean;
      current_version?: number;
      current_checked_by?: string;
      current_updated_at?: string;
      id?: string;
      room_id?: string;
      date?: string;
      checked_by?: string;
      version?: number;
      updated_at?: string;
      before_entries?: unknown;
      after_entries?: Array<{ student_id: string; status: string; note?: string | null }>;
    };

    if (result?.conflict) {
      throw new HttpError(
        409,
        `ห้องนี้เพิ่งถูกบันทึกโดย ${result.current_checked_by ?? "สตาฟท่านอื่น"} กรุณาตรวจสอบก่อนบันทึกทับ`,
        "VERSION_CONFLICT",
        {
          currentVersion: Number(result.current_version ?? 1),
          currentCheckedBy: result.current_checked_by ?? "สตาฟท่านอื่น",
          currentUpdatedAt: result.current_updated_at ?? new Date().toISOString(),
        }
      );
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: staff.staffName,
      actorRole: staff.role,
      action: parsed.force ? "attendance_force_saved" : "attendance_saved",
      entityType: "attendance_session",
      entityId: result.id ?? `${roomId}_${parsed.date}`,
      beforeData: { entriesCount: Array.isArray(result.before_entries) ? result.before_entries.length : 0 },
      afterData: {
        version: Number(result.version ?? 1),
        entriesCount: Array.isArray(result.after_entries) ? result.after_entries.length : 0,
      },
      ipHash,
    });

    const entriesMap: Record<
      string,
      { studentId: string; status: "present" | "absent" | "late" | "other"; note?: string }
    > = {};
    for (const item of result.after_entries ?? []) {
      entriesMap[item.student_id] = {
        studentId: item.student_id,
        status: item.status as "present" | "absent" | "late" | "other",
        ...(item.note ? { note: item.note } : {}),
      };
    }

    return NextResponse.json({
      record: {
        id: result.id as string,
        roomId: result.room_id as string,
        date: result.date as string,
        entries: entriesMap,
        checkedBy: result.checked_by as string,
        version: Number(result.version ?? 1),
        updatedAt: result.updated_at as string,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const date = dateKeySchema.parse(searchParams.get("date") ?? "");

    const supabase = getSupabaseServerClient();
    const sessionId = `${roomId}_${date}`;

    const { data: existing, error: fetchErr } = await supabase
      .from("attendance_sessions")
      .select("id, room_id, date, checked_by, version")
      .eq("id", sessionId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr) {
      throw new HttpError(500, "ไม่สามารถตรวจสอบรายการเช็คชื่อได้", "ATTENDANCE_DELETE_FAILED");
    }

    if (!existing) {
      return NextResponse.json({ ok: true });
    }

    // Layer-2 safety net: snapshot before deleting
    await createSystemSnapshot("pre_delete", admin.staffName);

    const nowIso = new Date().toISOString();
    const { error: deleteErr } = await supabase
      .from("attendance_sessions")
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .eq("id", sessionId);

    if (deleteErr) {
      throw new HttpError(500, "ไม่สามารถลบประวัติการเช็คชื่อได้", "ATTENDANCE_DELETE_FAILED");
    }

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: "attendance_deleted",
      entityType: "attendance_session",
      entityId: sessionId,
      beforeData: existing,
      afterData: { deleted_at: nowIso },
      ipHash,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
