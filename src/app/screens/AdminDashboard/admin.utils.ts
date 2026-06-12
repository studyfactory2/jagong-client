import type { AdminUser } from "../../../lib/types";

export function dateText(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
