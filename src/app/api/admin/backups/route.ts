import { NextResponse } from "next/server";
import { getSessionSecret, requireAdmin } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit";
import { createSystemSnapshot, listSystemSnapshots } from "@/lib/server/backup";
import { hashClientIp } from "@/lib/server/crypto";
import { getClientIp, handleApiError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = getSupabaseServerClient();

    // Fetch snapshots and soft-deleted items in parallel
    const [snapshots, deletedRoomsRes, deletedStudentsRes, deletedSessionsRes] =
      await Promise.all([
        listSystemSnapshots(25),
        supabase
          .from("rooms")
          .select("id, name, deleted_at")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(30),
        supabase
          .from("students")
          .select("id, room_id, seat_number, first_name, last_name, deleted_at")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(50),
        supabase
          .from("attendance_sessions")
          .select("id, room_id, date, checked_by, deleted_at")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(50),
      ]);

    return NextResponse.json({
      snapshots,
      deletedItems: {
        rooms: (deletedRoomsRes.data ?? []).map((r) => ({
          id: r.id as string,
          label: r.name as string,
          deletedAt: r.deleted_at as string,
        })),
        students: (deletedStudentsRes.data ?? []).map((s) => ({
          id: s.id as string,
          label: `เลขที่ ${s.seat_number} ${s.first_name} ${s.last_name} (${s.room_id})`,
          deletedAt: s.deleted_at as string,
        })),
        sessions: (deletedSessionsRes.data ?? []).map((a) => ({
          id: a.id as string,
          label: `${a.room_id} · ${String(a.date).slice(0, 10)} (โดย ${a.checked_by})`,
          deletedAt: a.deleted_at as string,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const snapshot = await createSystemSnapshot("manual", admin.staffName);

    const ipHash = hashClientIp(getClientIp(request), getSessionSecret());
    await writeAuditLog({
      actorName: admin.staffName,
      actorRole: "admin",
      action: "snapshot_created",
      entityType: "system_snapshot",
      entityId: String(snapshot.id),
      afterData: { reason: "manual", counts: snapshot.counts },
      ipHash,
    });

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
