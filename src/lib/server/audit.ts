import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AuditActorRole = "member" | "admin" | "owner" | "anonymous" | "system";

export interface AuditLogInput {
  actorName: string;
  actorRole: AuditActorRole;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  ipHash?: string | null;
}

/**
 * Appends an immutable entry to `audit_logs`.
 * Never log raw PINs, passwords, or Owner Recovery Keys!
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_name: input.actorName.slice(0, 100) || "unknown",
      actor_role: input.actorRole,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      before_data: input.beforeData ?? null,
      after_data: input.afterData ?? null,
      ip_hash: input.ipHash ?? null,
    });
    if (error) {
      console.error("[audit_logs] Failed to insert audit record:", error.message);
    }
  } catch (err) {
    console.error("[audit_logs] Unexpected audit error:", err);
  }
}
