"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartBar, DownloadSimple, House } from "@phosphor-icons/react";
import { AppShell } from "@/components/layout/app-shell";
import { DataErrorCard } from "@/components/shared/data-error-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers";
import { computeAttendanceCounts } from "@/lib/attendance-helpers";
import { downloadAttendanceCsv } from "@/lib/export-csv";
import {
  ApiClientError,
  attendanceRepository,
  DATA_CHANGED_EVENT,
} from "@/lib/repositories";
import { cn, getTodayDateKey, shiftDateKey } from "@/lib/utils";
import type { Room, RoomDailyAttendance, Student } from "@/types/attendance";

type DateRangeKey = "today" | "7d" | "all";
type ChartScope = "checked" | "all";

interface RoomChartDatum {
  roomId: string;
  roomName: string;
  program: string;
  daysChecked: number;
  present: number;
  late: number;
  absent: number;
  other: number;
  checkedTotal: number;
  attendanceRate: number;
}

const RANGE_OPTIONS: Array<{ key: DateRangeKey; label: string }> = [
  { key: "today", label: "วันนี้" },
  { key: "7d", label: "7 วันล่าสุด" },
  { key: "all", label: "ทั้งหมด" },
];

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
}

interface CustomChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: CustomTooltipPayloadItem[];
}

function GlassChartTooltip({ active, label, payload }: CustomChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--modal-surface)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] shadow-xl backdrop-blur-xl">
      <p className="mb-1.5 font-bold text-[var(--text-primary)]">{label}</p>
      <div className="space-y-1 tabular-nums">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="font-semibold text-[var(--text-primary)]">{item.value ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceRateRing({ rate }: { rate: number }) {
  const size = 56;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, rate));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent-blue-strong)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export default function SummaryPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<RoomDailyAttendance[]>([]);
  const [range, setRange] = useState<DateRangeKey>("all");
  const [chartScope, setChartScope] = useState<ChartScope>("checked");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; status?: number } | null>(null);

  const loadSummary = useCallback(async () => {
    setLoadError(null);
    try {
      const [loadedRooms, loadedStudents, loadedRecords] = await Promise.all([
        attendanceRepository.getRooms(),
        attendanceRepository.getAllStudents(),
        attendanceRepository.getAllAttendance(),
      ]);
      setRooms(loadedRooms);
      setStudents(loadedStudents);
      setRecords(loadedRecords);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        router.replace("/login");
        return;
      }
      setLoadError({
        message:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการโหลดข้อมูลสรุปผล",
        status: error instanceof ApiClientError ? error.status : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSummary();
    const onChange = () => loadSummary();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [loadSummary]);

  const studentsByRoom = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const student of students) {
      const list = map.get(student.roomId) ?? [];
      list.push(student);
      map.set(student.roomId, list);
    }
    return map;
  }, [students]);

  const rangedRecords = useMemo(() => {
    const todayKey = getTodayDateKey();
    if (range === "today") {
      return records.filter((r) => r.date === todayKey);
    }
    if (range === "7d") {
      const startKey = shiftDateKey(todayKey, -6);
      return records.filter((r) => r.date >= startKey && r.date <= todayKey);
    }
    return records;
  }, [records, range]);

  const { totals, perRoomData } = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let other = 0;

    const byRoom = new Map<string, RoomDailyAttendance[]>();
    for (const record of rangedRecords) {
      const list = byRoom.get(record.roomId) ?? [];
      list.push(record);
      byRoom.set(record.roomId, list);
    }

    const roomRows: RoomChartDatum[] = rooms.map((room) => {
      const roomRecords = byRoom.get(room.id) ?? [];
      const roomStudents = studentsByRoom.get(room.id) ?? [];
      let rPresent = 0;
      let rLate = 0;
      let rAbsent = 0;
      let rOther = 0;

      for (const record of roomRecords) {
        const c = computeAttendanceCounts(roomStudents, record.entries);
        rPresent += c.present;
        rLate += c.late;
        rAbsent += c.absent;
        rOther += c.other;
      }

      present += rPresent;
      late += rLate;
      absent += rAbsent;
      other += rOther;

      const checkedTotal = rPresent + rLate + rAbsent + rOther;
      const attendanceRate =
        checkedTotal > 0 ? Math.round(((rPresent + rLate) / checkedTotal) * 1000) / 10 : 0;

      return {
        roomId: room.id,
        roomName: room.name,
        program: room.program,
        daysChecked: roomRecords.length,
        present: rPresent,
        late: rLate,
        absent: rAbsent,
        other: rOther,
        checkedTotal,
        attendanceRate,
      };
    });

    const checkedTotal = present + late + absent + other;
    const rate =
      checkedTotal > 0 ? Math.round(((present + late) / checkedTotal) * 1000) / 10 : 0;

    return {
      totals: { present, late, absent, other, checkedTotal, rate },
      perRoomData: roomRows,
    };
  }, [rangedRecords, rooms, studentsByRoom]);

  const chartData = useMemo(() => {
    if (chartScope === "all") return perRoomData;
    const checkedOnly = perRoomData.filter((row) => row.daysChecked > 0);
    return checkedOnly.length > 0 ? checkedOnly : perRoomData;
  }, [perRoomData, chartScope]);

  const handleExportCsv = () => {
    if (rangedRecords.length === 0) {
      showToast("ยังไม่มีข้อมูลในช่วงวันที่เลือกสำหรับส่งออก CSV", "info");
      return;
    }
    downloadAttendanceCsv(rangedRecords, rooms, students, range);
    showToast("ดาวน์โหลดไฟล์ CSV (UTF-8 BOM) เรียบร้อยแล้ว", "success");
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pt-8">
        {/* Page Header (sentence-case quiet eyebrow) */}
        <header className="mb-6 flex flex-col justify-between gap-4 pl-14 sm:flex-row sm:items-end lg:pl-0">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">
              สรุปผล · สีฟ้าเช็คชื่อกันน
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] sm:text-3xl">
              สรุปผลและส่งออกรายงาน
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              ภาพรวมสถิติการมาเรียนคณะสีฟ้าทุกห้อง พร้อมส่งออกไฟล์ CSV สำหรับ Excel ภาษาไทย
            </p>
          </div>

          {records.length > 0 && (
            <Button type="button" onClick={handleExportCsv} className="self-start sm:self-auto">
              <DownloadSimple size={17} weight="bold" aria-hidden="true" />
              <span>Export CSV</span>
            </Button>
          )}
        </header>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="liquid-glass-panel h-28 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : loadError ? (
          <DataErrorCard
            message={loadError.message}
            status={loadError.status}
            onRetry={() => {
              setLoading(true);
              loadSummary();
            }}
          />
        ) : records.length === 0 ? (
          /* Clean 0-Day Empty State */
          <section className="liquid-glass-hero mx-auto mt-8 max-w-lg rounded-3xl px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-blue-soft)] text-[var(--accent-ink)]">
              <ChartBar size={28} weight="regular" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">
              ยังไม่มีข้อมูลสรุปผล
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              เมื่อเริ่มเช็คชื่อและบันทึกข้อมูลอย่างน้อย 1 ห้อง กราฟเปรียบเทียบรายห้องและปุ่ม Export CSV จะพร้อมใช้งานทันที
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/">
                <House size={18} weight="regular" aria-hidden="true" />
                <span>ไปหน้าโฮมเพื่อเริ่มเช็คชื่อ</span>
              </Link>
            </Button>
          </section>
        ) : (
          <div className="space-y-6">
            {/* Range Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1"
                role="group"
                aria-label="เลือกช่วงวันที่สรุปผล"
              >
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setRange(option.key)}
                    aria-pressed={range === option.key}
                    className={cn(
                      "min-h-9 rounded-lg px-3.5 text-xs font-semibold transition-colors duration-150 cursor-pointer sm:text-sm",
                      range === option.key
                        ? "bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)] shadow-xs"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
                รวม {rangedRecords.length} รอบการบันทึก · เช็คชื่อทั้งหมด {totals.checkedTotal} คน-ครั้ง
              </span>
            </div>

            {rangedRecords.length === 0 ? (
              <div className="liquid-glass-panel rounded-2xl px-6 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  ยังไม่มีการเช็คชื่อในช่วงวันที่เลือก
                </p>
                <button
                  type="button"
                  onClick={() => setRange("all")}
                  className="mt-2 text-xs font-semibold text-[var(--accent-ink)] hover:underline cursor-pointer"
                >
                  ดูข้อมูลสะสมทั้งหมด
                </button>
              </div>
            ) : (
              <>
                {/* 4 Numbers-First KPI Stat Cards (unslop discipline: crisp figures, one progress ring moment) */}
                <section
                  aria-label="ตัวเลขสรุปสำคัญ"
                  className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
                >
                  <div className="liquid-glass-panel flex items-center justify-between gap-3 rounded-2xl p-4 sm:p-5">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        อัตราการมาเรียน
                      </p>
                      <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-[var(--text-primary)] tabular-nums">
                        {totals.rate}%
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        มา + สาย เทียบยอดเช็ค
                      </p>
                    </div>
                    <div className="shrink-0">
                      <AttendanceRateRing rate={totals.rate} />
                    </div>
                  </div>

                  <div className="liquid-glass-panel rounded-2xl p-4 sm:p-5">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">มาเรียน</p>
                    <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-[var(--status-present-text)] tabular-nums">
                      {totals.present}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">คน-ครั้ง</p>
                  </div>

                  <div className="liquid-glass-panel rounded-2xl p-4 sm:p-5">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">มาสาย</p>
                    <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-[var(--status-late-text)] tabular-nums">
                      {totals.late}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">คน-ครั้ง</p>
                  </div>

                  <div className="liquid-glass-panel rounded-2xl p-4 sm:p-5">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">
                      ไม่มา / อื่นๆ
                    </p>
                    <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-[var(--text-primary)] tabular-nums">
                      {totals.absent + totals.other}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)] tabular-nums">
                      ไม่มา {totals.absent} · อื่นๆ {totals.other}
                    </p>
                  </div>
                </section>

                {/* Recharts BarChart with soft theme-tuned gradients & checked-rooms scope switch */}
                <section
                  aria-label="กราฟเปรียบเทียบการเช็คชื่อแยกตามห้อง"
                  className="liquid-glass-panel rounded-3xl p-5 sm:p-6"
                >
                  <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-base font-bold text-[var(--text-primary)] sm:text-lg">
                        เปรียบเทียบสถานะการเช็คชื่อแยกตามห้องเรียน
                      </h2>
                      <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                        กำลังแสดง {chartData.length} จาก {rooms.length} ห้อง
                      </p>
                    </div>

                    <div
                      className="inline-flex self-start rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-0.5 text-xs"
                      role="group"
                      aria-label="ขอบเขตห้องในกราฟ"
                    >
                      <button
                        type="button"
                        onClick={() => setChartScope("checked")}
                        aria-pressed={chartScope === "checked"}
                        className={cn(
                          "min-h-8 rounded-lg px-3 font-medium transition-colors cursor-pointer",
                          chartScope === "checked"
                            ? "bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)]"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        ห้องที่เช็คแล้ว
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartScope("all")}
                        aria-pressed={chartScope === "all"}
                        className={cn(
                          "min-h-8 rounded-lg px-3 font-medium transition-colors cursor-pointer",
                          chartScope === "all"
                            ? "bg-[var(--accent-blue-strong)] text-[var(--text-on-accent)]"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        ทุกห้อง ({rooms.length})
                      </button>
                    </div>
                  </div>

                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        barCategoryGap="28%"
                        maxBarSize={48}
                        margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-present)" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="var(--chart-present-fade)" stopOpacity={0.78} />
                          </linearGradient>
                          <linearGradient id="gradLate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-late)" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="var(--chart-late-fade)" stopOpacity={0.8} />
                          </linearGradient>
                          <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-absent)" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="var(--chart-absent-fade)" stopOpacity={0.8} />
                          </linearGradient>
                          <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-other)" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="var(--chart-other-fade)" stopOpacity={0.8} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border-subtle)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="roomName"
                          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                          axisLine={{ stroke: "var(--border-subtle)" }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "var(--bg-subtle)" }}
                          content={<GlassChartTooltip />}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                        <Bar dataKey="present" name="มา" stackId="a" fill="url(#gradPresent)" />
                        <Bar dataKey="late" name="สาย" stackId="a" fill="url(#gradLate)" />
                        <Bar dataKey="absent" name="ไม่มา" stackId="a" fill="url(#gradAbsent)" />
                        <Bar
                          dataKey="other"
                          name="อื่นๆ"
                          stackId="a"
                          fill="url(#gradOther)"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Breakdown Table Per Room */}
                <section
                  aria-label="ตารางสรุปรายห้องเรียน"
                  className="liquid-glass-panel overflow-hidden rounded-3xl"
                >
                  <div className="border-b border-[var(--border-subtle)] px-5 py-4">
                    <h2 className="text-base font-bold text-[var(--text-primary)]">
                      ตารางสรุปรายห้องเรียน
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
                        <tr>
                          <th className="px-5 py-3">ห้อง</th>
                          <th className="px-3 py-3 text-center">จำนวนวันเช็ค</th>
                          <th className="px-3 py-3 text-right">มา</th>
                          <th className="px-3 py-3 text-right">สาย</th>
                          <th className="px-3 py-3 text-right">ไม่มา</th>
                          <th className="px-3 py-3 text-right">อื่นๆ</th>
                          <th className="px-5 py-3 text-right">อัตราการมา</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)] tabular-nums">
                        {perRoomData.map((row) => (
                          <tr
                            key={row.roomId}
                            className="transition-colors duration-150 hover:bg-[var(--accent-blue-soft)]/35"
                          >
                            <td className="px-5 py-3.5">
                              <Link
                                href={`/rooms/${row.roomId}`}
                                className="font-bold text-[var(--text-primary)] hover:text-[var(--accent-ink)] hover:underline"
                              >
                                {row.roomName}
                              </Link>
                              <p className="text-xs text-[var(--text-muted)]">{row.program}</p>
                            </td>
                            <td className="px-3 py-3.5 text-center text-[var(--text-secondary)]">
                              {row.daysChecked}
                            </td>
                            <td className="px-3 py-3.5 text-right font-semibold text-[var(--status-present-text)]">
                              {row.present}
                            </td>
                            <td className="px-3 py-3.5 text-right font-semibold text-[var(--status-late-text)]">
                              {row.late}
                            </td>
                            <td className="px-3 py-3.5 text-right font-semibold text-[var(--status-absent-text)]">
                              {row.absent}
                            </td>
                            <td className="px-3 py-3.5 text-right font-semibold text-[var(--status-other-text)]">
                              {row.other}
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-[var(--text-primary)]">
                              {row.checkedTotal > 0 ? `${row.attendanceRate}%` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
