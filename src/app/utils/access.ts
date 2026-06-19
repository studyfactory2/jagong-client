import type { AuthUser } from "../../lib/types";

export function isManager(user?: AuthUser | null): boolean {
  return user?.role === "ADMIN" || user?.role === "STAFF";
}

export function hasActiveMembership(user?: AuthUser | null): boolean {
  if (!user?.membershipEnd) return false;
  const end = new Date(user.membershipEnd);
  return !Number.isNaN(end.getTime()) && end.getTime() > Date.now();
}

export function memberHomePath(user?: AuthUser | null): string {
  if (isManager(user)) return "/admin";
  return hasActiveMembership(user) ? "/waiting-room" : "/payments";
}
