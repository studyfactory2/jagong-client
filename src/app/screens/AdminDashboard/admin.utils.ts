import type { AdminUser } from "../../../lib/types";

export function dateText(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function dateOnlyText(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function membershipEndText(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  date.setDate(date.getDate() - 1);
  return dateOnlyText(date.toISOString());
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
  if (!value) return "결제일 없음";
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return "결제일 없음";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
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
