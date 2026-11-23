import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/server/http";

export type RateLimitScope = "login" | "owner_recovery";

interface RateLimitRow {
  key_hash: string;
  scope: RateLimitScope;
  attempts: number;
  total_failures_hour: number;
  window_started_at: string;
  hour_started_at: string;
  locked_until: string | null;
}

const SCOPE_CONFIG: Record<
  RateLimitScope,
  {
    maxAttemptsPerWindow: number;
    windowMs: number;
    firstLockMs: number;
    repeatFailureThreshold: number;
    escalatedLockMs: number;
  }
> = {
  login: {
    maxAttemptsPerWindow: 5,
    windowMs: 15 * 60 * 1000, // 15 min
    firstLockMs: 15 * 60 * 1000, // 15 min lockout
    repeatFailureThreshold: 8,
    escalatedLockMs: 60 * 60 * 1000, // 60 min lockout
  },
  owner_recovery: {
    maxAttemptsPerWindow: 3,
    windowMs: 60 * 60 * 1000, // 60 min
    firstLockMs: 60 * 60 * 1000, // 60 min lockout
    repeatFailureThreshold: 5,
    escalatedLockMs: 180 * 60 * 1000, // 3 hour lockout
  },
};

function makeRowKey(scope: RateLimitScope, ipHash: string): string {
  return `${scope}:${ipHash}`;
}

export async function assertNotRateLimited(
  scope: RateLimitScope,
  ipHash: string
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const keyHash = makeRowKey(scope, ipHash);

  const { data, error } = await supabase
    .from("auth_rate_limits")
    .select("*")
    .eq("key_hash", keyHash)
    .maybeSingle<RateLimitRow>();

  if (error) {
    throw new HttpError(
      503,
      "ไม่สามารถตรวจสอบสถานะความปลอดภัยได้ชั่วคราว",
      "RATE_LIMIT_UNAVAILABLE"
    );
  }

  if (!data?.locked_until) return;

  const lockedUntilMs = new Date(data.locked_until).getTime();
  const nowMs = Date.now();
  if (lockedUntilMs > nowMs) {
    const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 1000));
    const minutes = Math.ceil(retryAfterSeconds / 60);
    throw new HttpError(
      429,
      `กรอกรหัสผิดเกินกำหนด ถูกล็อกชั่วคราว กรุณารออีกประมาณ ${minutes} นาที`,
      "RATE_LIMITED",
      { retryAfterSeconds, lockedUntil: data.locked_until }
    );
  }
}

export async function recordAuthFailure(
  scope: RateLimitScope,
  ipHash: string
): Promise<{
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  lockedUntil?: string;
}> {
  const supabase = getSupabaseServerClient();
  const keyHash = makeRowKey(scope, ipHash);
  const cfg = SCOPE_CONFIG[scope];
  const now = new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  const { data: existing } = await supabase
    .from("auth_rate_limits")
    .select("*")
    .eq("key_hash", keyHash)
    .maybeSingle<RateLimitRow>();

  const windowExpired =
    !existing || nowMs - new Date(existing.window_started_at).getTime() > cfg.windowMs;
  const hourExpired =
    !existing || nowMs - new Date(existing.hour_started_at).getTime() > 60 * 60 * 1000;

  const nextAttempts = windowExpired ? 1 : existing.attempts + 1;
  const nextHourFailures = hourExpired ? 1 : existing.total_failures_hour + 1;
  const nextWindowStart = windowExpired ? nowIso : existing.window_started_at;
  const nextHourStart = hourExpired ? nowIso : existing.hour_started_at;

  let lockedUntil: string | null = null;
  let retryAfterSeconds: number | undefined;

  if (nextAttempts >= cfg.maxAttemptsPerWindow) {
    const lockDurationMs =
      nextHourFailures >= cfg.repeatFailureThreshold
        ? cfg.escalatedLockMs
        : cfg.firstLockMs;
    lockedUntil = new Date(nowMs + lockDurationMs).toISOString();
    retryAfterSeconds = Math.ceil(lockDurationMs / 1000);
  }

  await supabase.from("auth_rate_limits").upsert(
    {
      key_hash: keyHash,
      scope,
      attempts: lockedUntil ? 0 : nextAttempts,
      total_failures_hour: nextHourFailures,
      window_started_at: lockedUntil ? nowIso : nextWindowStart,
      hour_started_at: nextHourStart,
      locked_until: lockedUntil,
      updated_at: nowIso,
    },
    { onConflict: "key_hash" }
  );

  return {
    locked: Boolean(lockedUntil),
    remainingAttempts: lockedUntil
      ? 0
      : Math.max(0, cfg.maxAttemptsPerWindow - nextAttempts),
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    ...(lockedUntil ? { lockedUntil } : {}),
  };
}

export async function resetRateLimit(scope: RateLimitScope, ipHash: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const keyHash = makeRowKey(scope, ipHash);
  await supabase.from("auth_rate_limits").delete().eq("key_hash", keyHash);
}
