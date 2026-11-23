"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  House,
  ClockCounterClockwise,
  ChartBar,
  List,
  Sun,
  Moon,
  SignOut,
  Sparkle,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { DeveloperFooter } from "@/components/layout/developer-footer";

type GuardFn = (nextAction: () => void) => boolean;

interface NavigationGuardContextValue {
  setGuard: (fn: GuardFn | null) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue>({
  setGuard: () => {},
});

export function useNavigationGuard(guardFn: GuardFn | null) {
  const { setGuard } = useContext(NavigationGuardContext);
  useEffect(() => {
    setGuard(guardFn);
    return () => setGuard(null);
  }, [guardFn, setGuard]);
}

const BASE_NAV_ITEMS = [
  { href: "/", label: "หน้าโฮม", icon: House },
  { href: "/history", label: "ประวัติ", icon: ClockCounterClockwise },
  { href: "/summary", label: "สรุปผล", icon: ChartBar },
] as const;

const ADMIN_NAV_ITEM = {
  href: "/admin",
  label: "ผู้ดูแลระบบ",
  icon: ShieldCheck,
} as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isReady, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const guardRef = useRef<GuardFn | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isReady && !session) {
      router.replace("/login");
    }
  }, [isReady, session, router]);

  const setGuard = useCallback((fn: GuardFn | null) => {
    guardRef.current = fn;
  }, []);

  const runWithGuard = useCallback((action: () => void) => {
    if (guardRef.current) {
      const intercepted = guardRef.current(action);
      if (intercepted) {
        return;
      }
    }
    action();
  }, []);

  const handleNavigate = useCallback(
    (href: string) => {
      setDrawerOpen(false);
      if (href === pathname) return;
      runWithGuard(() => {
        router.push(href);
      });
    },
    [pathname, router, runWithGuard]
  );

  const handleLogout = useCallback(() => {
    setDrawerOpen(false);
    runWithGuard(() => {
      void logout().then(() => {
        router.replace("/login");
      });
    });
  }, [logout, router, runWithGuard]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const isDark = mounted && resolvedTheme === "dark";
  const staffInitial = session?.staffName?.trim().charAt(0).toUpperCase() || "B";
  const navItems =
    session?.role === "admin" ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] : [...BASE_NAV_ITEMS];

  if (!isReady || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="liquid-glass-panel flex items-center gap-3 rounded-full px-5 py-3 text-sm text-[var(--text-secondary)]">
          <Sparkle size={18} weight="fill" className="animate-pulse text-[var(--accent-blue-strong)]" />
          <span>กำลังโหลด BLUE CHECK-IN...</span>
        </div>
      </div>
    );
  }

  return (
    <NavigationGuardContext.Provider value={{ setGuard }}>
      <div className="min-h-dvh">
        {/* Desktop Slim Left Sidebar (inspired by photo/bmJ6juQ9.jpeg) */}
        <aside
          aria-label="เมนูหลัก"
          className="fixed inset-y-0 left-0 z-40 hidden w-[78px] flex-col items-center justify-between border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] py-5 backdrop-blur-xl lg:flex"
        >
          <div className="flex flex-col items-center gap-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  onClick={(e) => {
                    if (guardRef.current) {
                      e.preventDefault();
                      handleNavigate("/");
                    }
                  }}
                  aria-label="กลับหน้าโฮม BLUE CHECK-IN"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-md transition-transform hover:scale-105"
                >
                  <Sparkle size={22} weight="fill" aria-hidden="true" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">BLUE CHECK-IN · หน้าโฮม</TooltipContent>
            </Tooltip>

            <nav className="flex flex-col items-center gap-2.5" aria-label="นำทางหลัก">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/" || pathname.startsWith("/rooms")
                    : pathname.startsWith(item.href);

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.href)}
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-150 cursor-pointer",
                          isActive
                            ? "bg-[var(--accent-blue-soft)] text-[var(--accent-blue-strong)] border border-[var(--border-strong)] shadow-sm"
                            : "text-[var(--text-secondary)] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        <Icon size={22} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col items-center gap-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {isDark ? (
                    <Sun size={20} weight="duotone" aria-hidden="true" />
                  ) : (
                    <Moon size={20} weight="duotone" aria-hidden="true" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isDark ? "สลับเป็น Light Mode" : "สลับเป็น Dark Mode"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  role="img"
                  aria-label={`สตาฟ: ${session.staffName}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--accent-blue-soft)] text-sm font-bold text-[var(--text-primary)] select-none"
                >
                  {staffInitial}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                ผู้ใช้งาน: {session.staffName} ({session.role === "admin" ? "Admin" : "Member"})
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="ออกจากระบบ"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--text-muted)] transition-colors hover:bg-[var(--status-absent-bg)] hover:text-[var(--status-absent-text)] cursor-pointer"
                >
                  <SignOut size={20} weight="regular" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">ออกจากระบบ</TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* Mobile & Tablet Floating Hamburger Button + Slide-Out Drawer */}
        <div className="fixed left-3 top-3 z-50 lg:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="เปิดเมนูนำทาง"
                className="liquid-glass-panel flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--text-primary)] shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                <List size={22} weight="bold" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left">
              <div className="flex items-center gap-3 pr-10">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-sm">
                  <Sparkle size={20} weight="fill" aria-hidden="true" />
                </div>
                <div>
                  <SheetTitle className="font-display tracking-[0.12em] uppercase">
                    BLUE CHECK-IN
                  </SheetTitle>
                  <SheetDescription>สีฟ้าเช็คชื่อกันน</SheetDescription>
                </div>
              </div>

              <Separator className="my-5" />

              <nav className="flex flex-1 flex-col gap-1.5" aria-label="นำทางมือถือ">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/"
                      ? pathname === "/" || pathname.startsWith("/rooms")
                      : pathname.startsWith(item.href);

                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => handleNavigate(item.href)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 items-center gap-3.5 rounded-2xl px-4 text-left text-sm font-medium transition-colors cursor-pointer",
                        isActive
                          ? "border border-[var(--border-strong)] bg-[var(--accent-blue-soft)] text-[var(--accent-blue-strong)] font-semibold"
                          : "text-[var(--text-secondary)] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <Icon size={20} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <Separator className="my-4" />

              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-blue-soft)] text-sm font-bold text-[var(--text-primary)]">
                    {staffInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {session.role === "admin" ? "ผู้ดูแลระบบ (Admin)" : "สตาฟผู้ใช้งาน"}
                    </p>
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {session.staffName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--accent-blue-soft)] cursor-pointer transition-colors"
                  >
                    {isDark ? (
                      <>
                        <Sun size={16} weight="duotone" aria-hidden="true" />
                        <span>โหมดสว่าง</span>
                      </>
                    ) : (
                      <>
                        <Moon size={16} weight="duotone" aria-hidden="true" />
                        <span>โหมดมืด</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--status-absent-border)]/40 bg-[var(--status-absent-bg)] px-3 text-xs font-medium text-[var(--status-absent-text)] hover:opacity-90 cursor-pointer transition-opacity"
                  >
                    <SignOut size={16} weight="bold" aria-hidden="true" />
                    <span>ออกระบบ</span>
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Main Content Canvas */}
        <div className="flex min-h-dvh flex-col lg:pl-[78px]">
          <div className="flex-1">{children}</div>
          <DeveloperFooter clearStickyBar={pathname.startsWith("/rooms")} />
        </div>
      </div>
    </NavigationGuardContext.Provider>
  );
}
