import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { handleApiError, HttpError } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const actionFilter = searchParams.get("action")?.trim();
    const limitParam = Number(searchParams.get("limit") ?? "60");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 60;

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("audit_logs")
      .select(
        "id, actor_name, actor_role, action, entity_type, entity_id, before_data, after_data, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (actionFilter && actionFilter !== "all") {
      query = query.eq("action", actionFilter);
    }

    const { data, error } = await query;
    if (error) {
      throw new HttpError(500, "ไม่สามารถโหลด Audit Log ได้", "AUDIT_LOAD_FAILED");
    }

    const logs = (data ?? []).map((row) => ({
      id: Number(row.id),
      actorName: row.actor_name as string,
      actorRole: row.actor_role as string,
      action: row.action as string,
      entityType: row.entity_type as string,
      entityId: (row.entity_id as string | null) ?? null,
      beforeData: row.before_data ?? null,
      afterData: row.after_data ?? null,
      createdAt: row.created_at as string,
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    return handleApiError(error);
  }
}
