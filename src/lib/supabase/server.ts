import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class ServerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerConfigError";
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigFingerprint = "";

/**
 * Returns a server-only Supabase client authenticated with SUPABASE_SECRET_KEY.
 * Fails closed with ServerConfigError (HTTP 503) if required server env vars are absent.
 */
export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey || secretKey.includes("replace_with")) {
    throw new ServerConfigError(
      "ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูลฝั่งเซิร์ฟเวอร์ (SUPABASE_URL / SUPABASE_SECRET_KEY)"
    );
  }

  const fingerprint = `${url}|${secretKey.slice(0, 12)}|${secretKey.length}`;
  if (cachedClient && cachedConfigFingerprint === fingerprint) {
    return cachedClient;
  }

  cachedClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  cachedConfigFingerprint = fingerprint;
  return cachedClient;
}
