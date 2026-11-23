"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClockCounterClockwise,
  Database,
  Key,
  ShieldCheck,
  Users,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/layout/app-shell";
import { RosterManagerTab } from "@/components/admin/roster-manager-tab";
import { SecurityPinsTab } from "@/components/admin/security-pins-tab";
import { AuditLogsTab } from "@/components/admin/audit-logs-tab";
import { BackupRecoveryTab } from "@/components/admin/backup-recovery-tab";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type AdminTab = "roster" | "security" | "audit" | "backup";

const TABS: Array<{
  key: AdminTab;
  label: string;
  icon: React.ComponentType<{ size?: number; weight?: "regular" | "fill" | "bold" }>;
}> = [
  { key: "roster", label: "ห้อง & นักเรียน", icon: Users },
  { key: "security", label: "รหัส PIN & สิทธิ์", icon: Key },
  { key: "audit", label: "Audit Log", icon: ClockCounterClockwise },
  { key: "backup", label: "Backup & Recovery", icon: Database },
];

export default function AdminPage() {
  const router = useRouter();
  const { session, isReady } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("roster");

  useEffect(() => {
    if (isReady && session && session.role !== "admin") {
      router.replace("/");
    }
  }, [isReady, session, router]);

  if (!isReady || !session || session.role !== "admin") {
    return (
      <AppShell>
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pt-8">
          <div className="liquid-glass-panel h-48 animate-pulse rounded-3xl" />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pt-8">
        <header className="mb-6 pl-14 lg:pl-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-ink)]">
            <ShieldCheck size={15} weight="fill" aria-hidden="true" />
            <span>Admin Console · ผู้ดูแลระบบ ({session.staffName})</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] sm:text-3xl">
            ศูนย์จัดการระบบหลังบ้าน
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            จัดการห้องเรียนและรายชื่อนักเรียน เปลี่ยนรหัส PIN ตรวจสอบ Audit Log และสำรอง/กู้คืนฐานข้อมูล
          </p>
        </header>

        {/* Tab Bar */}
        <nav
          aria-label="หมวดหมู่การจัดการระบบ"
          className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1.5"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition-colors duration-150 cursor-pointer sm:flex-none sm:text-sm",
                  active
                    ? "bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-xs"
                    : "text-[var(--text-secondary)] hover:bg-[var(--accent-blue-soft)]/50 hover:text-[var(--text-primary)]"
                )}
              >
                <Icon size={17} weight={active ? "fill" : "regular"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {activeTab === "roster" && <RosterManagerTab />}
        {activeTab === "security" && <SecurityPinsTab />}
        {activeTab === "audit" && <AuditLogsTab />}
        {activeTab === "backup" && <BackupRecoveryTab />}
      </main>
    </AppShell>
  );
}
