import { NextResponse } from "next/server";
import { clearSessionCookie, getValidatedSession } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getValidatedSession();
    if (!session) {
      const response = NextResponse.json({ session: null });
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.json({
      session: {
        staffName: session.staffName,
        role: session.role,
        loggedInAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
