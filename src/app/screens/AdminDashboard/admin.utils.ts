import type { AdminUser } from "../../../lib/types";

const KST_OFFSET_MINUTES = 9 * 60;
const BUSINESS_TIME_ZONE = "Asia/Seoul";
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function dateOnlyFromParts(year: number, month: number, day: number) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function isValidCalendarDate({ year, month, day }: DateParts): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function parseDateOnlyParts(value?: string | null): DateParts | null {
  if (!value) return null;
  const match = DATE_ONLY_RE.exec(value.trim());
  if (match) {
    const parts: DateParts = {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
    return isValidCalendarDate(parts) ? parts : null;
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const date = new Date(instant.getTime() + KST_OFFSET_MINUTES * 60_000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function toDateInputValue(value?: string | null): string {
  const parts = parseDateOnlyParts(value);
  if (!parts) return "";
  return dateOnlyFromParts(parts.year, parts.month, parts.day);
}

export function todayDateInputValue(): string {
  const now = new Date();
  const today = new Date(now.getTime() + KST_OFFSET_MINUTES * 60_000);
  return dateOnlyFromParts(
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
    today.getUTCDate(),
  );
}

export function formatDateInputForDisplay(value?: string | null) {
  const dateOnly = toDateInputValue(value);
  if (!dateOnly) return "-";
  const [year, month, day] = dateOnly.split("-");
  return `${year}.${month}.${day}.`;
}

export function addDaysDateOnly(value: string, days: number): string | null {
  const parts = parseDateOnlyParts(value);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dateOnlyFromParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

export function addCalendarMonthsDateOnly(
  value: string,
  monthsToAdd: number,
): string | null {
  const parts = parseDateOnlyParts(value);
  if (!parts) return null;

  const targetMonthIndex = parts.month - 1 + monthsToAdd;
  const year = parts.year + Math.floor(targetMonthIndex / 12);
  const monthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return dateOnlyFromParts(year, monthIndex + 1, Math.min(parts.day, lastDay));
}

function daysBetweenDateOnly(
  fromValue: string,
  toValue: string,
): number | null {
  const from = parseDateOnlyParts(fromValue);
  const to = parseDateOnlyParts(toValue);
  if (!from || !to) return null;
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function resolveEffectiveStartDateOnly(
  selectedStart: string,
  existingMembershipEnd?: string | null,
): string {
  const existingStart = toDateInputValue(existingMembershipEnd);
  if (!existingStart) return selectedStart;
  return existingStart > selectedStart ? existingStart : selectedStart;
}

export function dateText(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function dateOnlyText(value?: string | null) {
  return formatDateInputForDisplay(value);
}

export function membershipEndText(value?: string | null) {
  const dateOnly = toDateInputValue(value);
  if (!dateOnly) return "-";
  return formatDateInputForDisplay(addDaysDateOnly(dateOnly, -1));
}

export function money(value: number) {
  return value.toLocaleString("ko-KR") + "원";
}

export function userName(users: AdminUser[], userId: string) {
  return (
    users.find((user) => user.id === userId || user.userId === userId)?.name ??
    "-"
  );
}

export function dDayText(value?: string | null) {
  const parts = parseDateOnlyParts(value);
  if (!parts) return "결제일 없음";
  const endDateOnly = dateOnlyFromParts(parts.year, parts.month, parts.day);
  const diff = daysBetweenDateOnly(todayDateInputValue(), endDateOnly);
  if (diff === null) return "결제일 없음";
  if (diff < 0) return "만료";
  if (diff === 0) return "D-Day";
  return "D-" + diff;
}

export function userDetail(value?: string | number | null, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function initial(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

const AVATAR_TONES = ["mint", "gold", "coral", "navy"] as const;

export function avatarTone(seed?: string | null) {
  const text = seed?.trim() || "?";
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash + text.charCodeAt(i)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[hash];
}
