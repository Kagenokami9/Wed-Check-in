import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const THAI_MONTHS_LONG = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const THAI_WEEKDAYS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

/**
 * Formats a Date into local YYYY-MM-DD without UTC timezone shift.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateKey(): string {
  return toDateKey(new Date());
}

/**
 * Parses a YYYY-MM-DD key safely into a local Date at noon (avoids DST/midnight issues).
 */
export function parseDateKey(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return new Date();
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day, 12, 0, 0);
}

export function isValidDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = parseDateKey(value);
  return toDateKey(parsed) === value;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + deltaDays);
  return toDateKey(date);
}

/**
 * Example: "22 พ.ย. 2569"
 */
export function formatThaiDateShort(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const buddhistYear = date.getFullYear() + 543;
  return `${date.getDate()} ${THAI_MONTHS_SHORT[date.getMonth()]} ${buddhistYear}`;
}

/**
 * Example: "วันอาทิตย์ที่ 22 พฤศจิกายน 2569"
 */
export function formatThaiDateFull(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const buddhistYear = date.getFullYear() + 543;
  const weekday = THAI_WEEKDAYS[date.getDay()];
  const month = THAI_MONTHS_LONG[date.getMonth()];
  return `วัน${weekday}ที่ ${date.getDate()} ${month} ${buddhistYear}`;
}

/**
 * Example: "14:32 น."
 */
export function formatThaiTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes} น.`;
}

export function formatDateHeadingLabel(dateKey: string): string {
  const today = getTodayDateKey();
  if (dateKey === today) {
    return `วันนี้ · ${formatThaiDateShort(dateKey)}`;
  }
  const yesterday = shiftDateKey(today, -1);
  if (dateKey === yesterday) {
    return `เมื่อวาน · ${formatThaiDateShort(dateKey)}`;
  }
  return formatThaiDateShort(dateKey);
}
