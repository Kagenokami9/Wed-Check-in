"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { StaffRole, StaffSession } from "@/types/attendance";

const RECENT_STAFF_KEY = "blue-checkin:recent-staff:v1";
const LEGACY_MOCK_KEYS = [
  "blue-checkin:attendance:v1",
  "blue-checkin:nicknames:v1",
  "blue-checkin:session:v1",
];

const DEFAULT_STAFF_PRESETS = ["สตาฟสีฟ้า", "พี่บอส", "พี่ฟ้า", "พี่โอม"];

export interface LoginResult {
  ok: boolean;
  role?: StaffRole;
  code?: string;
  error?: string;
  lockedUntil?: string;
  retryAfterSeconds?: number;
}

interface AuthContextValue {
  session: StaffSession | null;
  isReady: boolean;
  recentStaffNames: string[];
  loginWithPin: (
    staffName: string,
    pin: string,
    expectedRole?: StaffRole
  ) => Promise<LoginResult>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readRecentStaff(): string[] {
  if (typeof window === "undefined") return DEFAULT_STAFF_PRESETS;
  try {
    const raw = window.localStorage.getItem(RECENT_STAFF_KEY);
    if (!raw) return DEFAULT_STAFF_PRESETS;
    const parsed = JSON.parse(raw) as string[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 8);
    }
    return DEFAULT_STAFF_PRESETS;
  } catch {
    return DEFAULT_STAFF_PRESETS;
  }
}

function purgeLegacyMockKeys(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_MOCK_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage cleanup errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [recentStaffNames, setRecentStaffNames] = useState<string[]>(DEFAULT_STAFF_PRESETS);
  const [isReady, setIsReady] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        setSession(null);
        return;
      }
      const data = (await res.json()) as { session: StaffSession | null };
      setSession(data.session ?? null);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    purgeLegacyMockKeys();
    setRecentStaffNames(readRecentStaff());
    refreshSession().finally(() => setIsReady(true));
  }, [refreshSession]);

  const loginWithPin = useCallback(
    async (
      staffName: string,
      pin: string,
      expectedRole?: StaffRole
    ): Promise<LoginResult> => {
      const trimmedName = staffName.trim();
      if (!trimmedName) {
        return { ok: false, error: "กรุณากรอกหรือเลือกชื่อสตาฟก่อนเข้าสู่ระบบ" };
      }

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffName: trimmedName,
            pin: pin.trim(),
            ...(expectedRole ? { expectedRole } : {}),
          }),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          session?: StaffSession;
          code?: string;
          error?: string;
          details?: { retryAfterSeconds?: number; lockedUntil?: string };
        };

        if (!res.ok || !payload.session) {
          return {
            ok: false,
            code: payload.code,
            error: payload.error ?? "รหัส PIN 6 หลักไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
            retryAfterSeconds: payload.details?.retryAfterSeconds,
            lockedUntil: payload.details?.lockedUntil,
          };
        }

        try {
          const updatedRecent = [
            trimmedName,
            ...readRecentStaff().filter((name) => name !== trimmedName),
          ].slice(0, 8);
          window.localStorage.setItem(RECENT_STAFF_KEY, JSON.stringify(updatedRecent));
          setRecentStaffNames(updatedRecent);
        } catch {
          // Ignore non-critical UI preference storage errors
        }

        setSession(payload.session);
        return { ok: true, role: payload.session.role };
      } catch {
        return {
          ok: false,
          error: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
        };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Clear local session state regardless of network failure
    } finally {
      setSession(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isReady,
        recentStaffNames,
        loginWithPin,
        refreshSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
