"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { ThemeProvider } from "next-themes";
import { CheckCircle, WarningCircle, Info } from "@phosphor-icons/react";
import { AuthProvider } from "@/lib/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within Providers");
  }
  return ctx;
}

function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Non-intrusive bottom toast placement: clears top headers and Save Bar on all viewports */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-4 bottom-24 z-[70] flex flex-col items-center gap-2 lg:inset-x-auto lg:bottom-24 lg:right-6 lg:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-[var(--border-strong)] bg-[var(--modal-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] shadow-xl backdrop-blur-xl"
          >
            {toast.tone === "success" && (
              <CheckCircle
                size={18}
                weight="fill"
                className="shrink-0 text-[var(--status-present-border)]"
                aria-hidden="true"
              />
            )}
            {toast.tone === "error" && (
              <WarningCircle
                size={18}
                weight="fill"
                className="shrink-0 text-[var(--status-absent-border)]"
                aria-hidden="true"
              />
            )}
            {toast.tone === "info" && (
              <Info
                size={18}
                weight="fill"
                className="shrink-0 text-[var(--accent-ink)]"
                aria-hidden="true"
              />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider delayDuration={180}>
          <ToastHost>{children}</ToastHost>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
