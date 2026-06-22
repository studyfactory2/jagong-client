import type { AuthUser } from "../../lib/types";

export function isManager(user?: AuthUser | null): boolean {
  return user?.role === "ADMIN" || user?.role === "STAFF";
}

export function hasActiveMembership(user?: AuthUser | null): boolean {
  if (!user?.startDate || !user.membershipEnd) return false;
  const start = new Date(user.startDate);
  const end = new Date(user.membershipEnd);
  const now = Date.now();
  return (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    start.getTime() <= now &&
    end.getTime() > now
  );
}

export function memberHomePath(user?: AuthUser | null): string {
  if (isManager(user)) return "/admin";
  return hasActiveMembership(user) ? "/waiting-room" : "/payments";
}
