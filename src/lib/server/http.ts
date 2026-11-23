import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ServerConfigError } from "@/lib/supabase/server";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    code = "REQUEST_ERROR",
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "127.0.0.1";
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ServerConfigError) {
    return NextResponse.json(
      { error: error.message, code: "SERVER_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  if (error instanceof HttpError) {
    const headers: Record<string, string> = {};
    if (
      error.status === 429 &&
      typeof error.details?.retryAfterSeconds === "number"
    ) {
      headers["Retry-After"] = String(Math.ceil(error.details.retryAfterSeconds));
    }
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.status, headers }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? "ข้อมูลที่ส่งมาไม่ถูกต้อง",
        code: "VALIDATION_ERROR",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  console.error("[API Error]", error);
  return NextResponse.json(
    {
      error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง",
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}
