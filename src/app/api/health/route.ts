import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("rooms").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          status: "database_unavailable",
          message:
            "ฐานข้อมูล Supabase ยังไม่ตอบสนอง (หากใช้ Free Tier อาจอยู่ในสถานะ Paused กรุณากด Restore ใน Dashboard)",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
