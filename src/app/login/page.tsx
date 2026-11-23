"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Backspace,
  Key,
  LockSimple,
  Moon,
  ShieldCheck,
  Sun,
  User,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { BrandMark } from "@/components/brand-mark";
import { useToast } from "@/components/providers";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StaffRole } from "@/types/attendance";

const PIN_LENGTH = 6;
const NUMPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export default function LoginPage() {
  const router = useRouter();
  const { session, isReady, recentStaffNames, loginWithPin } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [selectedRole, setSelectedRole] = useState<StaffRole>("member");
  const selectedRoleRef = useRef<StaffRole>("member");
  const [staffName, setStaffName] = useState("");
  const staffNameRef = useRef("");
  const [pin, setPin] = useState("");
  const pinRef = useRef("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const submitTimerRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // Owner Emergency PIN Reset Dialog state
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [ownerKey, setOwnerKey] = useState("");
  const [newStaffPin, setNewStaffPin] = useState("");
  const [newAdminPin, setNewAdminPin] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  const clearPendingSubmitTimer = useCallback(() => {
    if (submitTimerRef.current !== null) {
      window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
  }, []);

  const updateStaffName = useCallback((next: string) => {
    staffNameRef.current = next;
    setStaffName(next);
  }, []);

  const updatePin = useCallback((next: string) => {
    pinRef.current = next;
    setPin(next);
  }, []);

  const handleSelectRole = useCallback(
    (role: StaffRole) => {
      if (submittingRef.current) return;
      clearPendingSubmitTimer();
      selectedRoleRef.current = role;
      setSelectedRole(role);
      updatePin("");
      setError(null);
    },
    [clearPendingSubmitTimer, updatePin]
  );

  useEffect(() => {
    setMounted(true);
    return () => clearPendingSubmitTimer();
  }, [clearPendingSubmitTimer]);

  useEffect(() => {
    if (isReady && session) {
      router.replace("/");
    }
  }, [isReady, session, router]);

  useEffect(() => {
    if (isReady && !staffName && recentStaffNames.length > 0) {
      updateStaffName(recentStaffNames[0]);
    }
  }, [isReady, recentStaffNames, staffName, updateStaffName]);

  const attemptLogin = useCallback(
    async (nameValue: string, pinValue: string, roleValue: StaffRole) => {
      if (submittingRef.current) return;
      clearPendingSubmitTimer();
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const result = await loginWithPin(nameValue, pinValue, roleValue);
        if (result.ok) {
          setError(null);
          showToast(
            result.role === "admin"
              ? "เข้าสู่ระบบสิทธิ์ ผู้ดูแลระบบ (Admin) เรียบร้อยแล้ว"
              : "เข้าสู่ระบบสิทธิ์ สตาฟทั่วไป (Member) เรียบร้อยแล้ว",
            "success"
          );
          router.replace("/");
          return;
        }

        setError(result.error ?? "ไม่สามารถเข้าสู่ระบบได้");
        setShakeKey((k) => k + 1);
        if (!nameValue.trim()) {
          nameInputRef.current?.focus();
        } else {
          updatePin("");
        }
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [clearPendingSubmitTimer, loginWithPin, router, showToast, updatePin]
  );

  // Pure side-effect scheduling OUTSIDE state updater (prevents React 19 StrictMode double submit)
  const appendDigit = useCallback(
    (digit: string) => {
      if (submittingRef.current) return;
      if (pinRef.current.length >= PIN_LENGTH) return;

      setError(null);
      const next = pinRef.current + digit;
      updatePin(next);

      if (next.length === PIN_LENGTH) {
        clearPendingSubmitTimer();
        submitTimerRef.current = window.setTimeout(() => {
          submitTimerRef.current = null;
          void attemptLogin(staffNameRef.current, next, selectedRoleRef.current);
        }, 90);
      }
    },
    [attemptLogin, clearPendingSubmitTimer, updatePin]
  );

  const handleBackspace = useCallback(() => {
    if (submittingRef.current) return;
    clearPendingSubmitTimer();
    setError(null);
    updatePin(pinRef.current.slice(0, -1));
  }, [clearPendingSubmitTimer, updatePin]);

  const handleClearPin = useCallback(() => {
    if (submittingRef.current) return;
    clearPendingSubmitTimer();
    setError(null);
    updatePin("");
  }, [clearPendingSubmitTimer, updatePin]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (recoveryOpen) return;
      const activeEl = document.activeElement;
      const isTypingInInput =
        activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;
      if (isTypingInInput) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClearPin();
      } else if (e.key === "Enter" && pinRef.current.length === PIN_LENGTH) {
        e.preventDefault();
        void attemptLogin(staffNameRef.current, pinRef.current, selectedRoleRef.current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appendDigit, attemptLogin, handleBackspace, handleClearPin, recoveryOpen]);

  const handlePastePin = (e: React.ClipboardEvent) => {
    if (recoveryOpen || submittingRef.current) return;
    const activeEl = document.activeElement;
    if (activeEl === nameInputRef.current) return;
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (digits.length > 0) {
      e.preventDefault();
      clearPendingSubmitTimer();
      setError(null);
      updatePin(digits);
      if (digits.length === PIN_LENGTH) {
        submitTimerRef.current = window.setTimeout(() => {
          submitTimerRef.current = null;
          void attemptLogin(staffNameRef.current, digits, selectedRoleRef.current);
        }, 80);
      }
    }
  };

  const handleEmergencyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySubmitting(true);
    try {
      const res = await fetch("/api/owner/recovery/reset-pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerRecoveryKey: ownerKey,
          newStaffPin,
          newAdminPin,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setRecoveryError(data.error ?? "ไม่สามารถรีเซ็ต PIN ได้");
        return;
      }
      showToast(data.message ?? "รีเซ็ตรหัส PIN เรียบร้อยแล้ว", "success");
      setRecoveryOpen(false);
      setOwnerKey("");
      setNewStaffPin("");
      setNewAdminPin("");
      updatePin("");
    } catch {
      setRecoveryError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setRecoverySubmitting(false);
    }
  };

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <main
      onPaste={handlePastePin}
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-6"
    >
      {/* Top-right Theme Toggle */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
        className="liquid-glass-panel fixed right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors duration-150"
      >
        {isDark ? (
          <Sun size={19} weight="regular" aria-hidden="true" />
        ) : (
          <Moon size={19} weight="regular" aria-hidden="true" />
        )}
      </button>

      {/* Compact Single-Screen Liquid Glass Login Card */}
      <section className="liquid-glass-hero relative w-full max-w-[420px] overflow-hidden rounded-3xl p-6 sm:p-7">
        <div className="relative z-10">
          {/* Brand Header */}
          <div className="text-center">
            <BrandMark size={48} className="mx-auto mb-3" />
            <h1 className="font-display text-2xl font-medium tracking-[0.18em] text-[var(--text-primary)] uppercase">
              BLUE CHECK-IN
            </h1>
            <p className="mt-1 text-xs font-medium text-[var(--text-secondary)] sm:text-sm">
              สีฟ้าเช็คชื่อกันน · เข้าสู่ระบบสตาฟ / ผู้ดูแล
            </p>
          </div>

          {/* Role Mode Switcher: Member vs Admin */}
          <div
            role="tablist"
            aria-label="เลือกระดับสิทธิ์เข้าสู่ระบบ"
            className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedRole === "member"}
              disabled={submitting}
              onClick={() => handleSelectRole("member")}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors duration-150 cursor-pointer",
                selectedRole === "member"
                  ? "bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <User size={15} weight={selectedRole === "member" ? "fill" : "regular"} aria-hidden="true" />
              <span>สตาฟทั่วไป</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedRole === "admin"}
              disabled={submitting}
              onClick={() => handleSelectRole("admin")}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors duration-150 cursor-pointer",
                selectedRole === "admin"
                  ? "bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <ShieldCheck size={15} weight={selectedRole === "admin" ? "fill" : "regular"} aria-hidden="true" />
              <span>ผู้ดูแลระบบ (Admin)</span>
            </button>
          </div>

          {/* Staff Name Picker / Input */}
          <div className="mt-4 space-y-2">
            <label
              htmlFor="staff-name"
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
            >
              <User size={15} weight="regular" aria-hidden="true" />
              <span>{selectedRole === "admin" ? "ชื่อผู้ดูแลระบบ" : "ชื่อสตาฟผู้เช็คชื่อ"}</span>
            </label>
            <Input
              ref={nameInputRef}
              id="staff-name"
              type="text"
              value={staffName}
              onChange={(e) => {
                updateStaffName(e.target.value);
                setError(null);
              }}
              placeholder="พิมพ์ชื่อสตาฟ เช่น พี่ฟ้า"
              autoComplete="name"
            />

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="เลือกชื่อสตาฟด่วน">
              {recentStaffNames.map((name) => {
                const isSelected = staffName.trim() === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      updateStaffName(name);
                      setError(null);
                    }}
                    className={cn(
                      "min-h-8 rounded-lg border px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer",
                      isSelected
                        ? "border-[var(--accent-blue-strong)] bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)]/75 text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6-Digit PIN Dots (server-verified scrypt hash + brute-force protection) */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <LockSimple size={15} weight="regular" aria-hidden="true" />
                <span>
                  {submitting
                    ? "กำลังตรวจสอบรหัส PIN..."
                    : selectedRole === "admin"
                      ? "กรอก Admin PIN 6 หลัก"
                      : "กรอก Member PIN 6 หลัก"}
                </span>
              </span>
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                {pin.length}/{PIN_LENGTH}
              </span>
            </div>

            <div
              key={shakeKey}
              aria-label={`กรอก PIN แล้ว ${pin.length} จาก ${PIN_LENGTH} หลัก`}
              className={cn(
                "flex items-center justify-center gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] py-3.5",
                shakeKey > 0 && error && "animate-shake border-[var(--status-absent-border)]"
              )}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
                const filled = idx < pin.length;
                return (
                  <span
                    key={idx}
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border-2 transition-[transform,background-color,border-color] duration-150",
                      filled
                        ? "scale-110 border-[var(--accent-blue-strong)] bg-[var(--accent-blue-strong)]"
                        : "border-[var(--border-strong)] bg-transparent"
                    )}
                  />
                );
              })}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--status-absent-border)]/45 bg-[var(--status-absent-bg)] px-3 py-2 text-xs font-medium text-[var(--status-absent-text)]"
              >
                <WarningCircle size={16} weight="fill" className="shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Tactile Frosted Glass 0-9 Numpad */}
          <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="แป้นตัวเลข PIN">
            {NUMPAD_KEYS.map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={submitting}
                onClick={() => appendDigit(digit)}
                className="glass-key flex min-h-[52px] items-center justify-center rounded-2xl text-xl font-medium text-[var(--text-primary)] disabled:opacity-50 cursor-pointer tabular-nums"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              disabled={submitting}
              onClick={handleClearPin}
              aria-label="ล้างรหัส PIN"
              className="flex min-h-[52px] items-center justify-center gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-xs font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)] active:scale-[0.96] disabled:opacity-50 cursor-pointer"
            >
              <X size={15} weight="bold" aria-hidden="true" />
              <span>ล้าง</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => appendDigit("0")}
              className="glass-key flex min-h-[52px] items-center justify-center rounded-2xl text-xl font-medium text-[var(--text-primary)] disabled:opacity-50 cursor-pointer tabular-nums"
            >
              0
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={handleBackspace}
              aria-label="ลบตัวเลขล่าสุด"
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)] active:scale-[0.96] disabled:opacity-50 cursor-pointer"
            >
              <Backspace size={20} weight="regular" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span>ตรวจสอบอัตโนมัติเมื่อครบ 6 หลัก</span>
            <button
              type="button"
              onClick={() => {
                setRecoveryError(null);
                setRecoveryOpen(true);
              }}
              className="inline-flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
            >
              <Key size={13} weight="regular" aria-hidden="true" />
              <span>รีเซ็ต PIN ฉุกเฉิน</span>
            </button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mt-4 text-center text-xs text-[var(--text-muted)]">
        พัฒนาโดย{" "}
        <span className="font-medium text-[var(--text-secondary)]">
          นายธารินทร ไผ่ล้อมทำเล
        </span>
      </footer>

      {/* Owner Emergency PIN Reset Dialog */}
      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <DialogContent closeLabel="ปิดหน้าต่างรีเซ็ต PIN ฉุกเฉิน">
          <DialogHeader className="px-4">
            <DialogTitle>รีเซ็ต PIN ฉุกเฉิน (เฉพาะเจ้าของระบบ)</DialogTitle>
            <DialogDescription>
              ใช้ Owner Recovery Key เพื่อตั้งรหัส Member PIN และ Admin PIN ใหม่ทั้งหมด และยกเลิกเซสชันเก่าทันที
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEmergencyReset} className="mt-4 space-y-3">
            <div>
              <label htmlFor="owner-key" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                Owner Recovery Key
              </label>
              <Input
                id="owner-key"
                type="password"
                required
                value={ownerKey}
                onChange={(e) => setOwnerKey(e.target.value)}
                placeholder="กรอก Owner Recovery Key"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="reset-staff-pin" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Member PIN ใหม่ (6 หลัก)
                </label>
                <Input
                  id="reset-staff-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={newStaffPin}
                  onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="6 หลัก"
                />
              </div>

              <div>
                <label htmlFor="reset-admin-pin" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Admin PIN ใหม่ (6 หลัก)
                </label>
                <Input
                  id="reset-admin-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={newAdminPin}
                  onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="6 หลัก"
                />
              </div>
            </div>

            {recoveryError && (
              <p role="alert" className="rounded-xl bg-[var(--status-absent-bg)] px-3 py-2 text-xs font-medium text-[var(--status-absent-text)]">
                {recoveryError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRecoveryOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={recoverySubmitting}>
                {recoverySubmitting ? "กำลังรีเซ็ต..." : "ยืนยันรีเซ็ต PIN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
