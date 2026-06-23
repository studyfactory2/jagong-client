import type { AuthUser } from "../../lib/types";

export function isManager(user?: AuthUser | null): boolean {
  return user?.role === "ADMIN" || user?.role === "STAFF";
}

export function getMembershipTime(user?: AuthUser | null): {
  start: number;
  end: number;
} | null {
  if (!user?.startDate || !user.membershipEnd) return null;
  const start = new Date(user.startDate);
  const end = new Date(user.membershipEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return { start: start.getTime(), end: end.getTime() };
}

export function hasActiveMembership(user?: AuthUser | null): boolean {
  const membership = getMembershipTime(user);
  if (!membership) return false;
  const now = Date.now();
  return (
    membership.start <= now &&
    membership.end > now
  );
}

export function hasFutureMembership(user?: AuthUser | null): boolean {
  const membership = getMembershipTime(user);
  if (!membership) return false;
  const now = Date.now();
  return membership.start > now && membership.end > now;
}

export function memberHomePath(user?: AuthUser | null): string {
  if (isManager(user)) return "/admin";
  return hasActiveMembership(user) ? "/waiting-room" : "/payments";
}

export function isMembershipAccessError(message: string): boolean {
  if (!message) return false;
  return (
    message.includes("이용권") ||
    message.includes("멤버십") ||
    message.includes("membership")
  );
}
