import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/auth.service";
import { useAuth } from "../context/AuthContext";
import { hasActiveMembership, isManager } from "../utils/access";

export default function MembershipRoute() {
  const { session, refreshUser } = useAuth();
  const [remoteCheck, setRemoteCheck] = useState<{
    token: string | null;
    allowed: boolean;
  }>({ token: null, allowed: false });
  const token = session?.token ?? null;
  const isCurrentManager = session ? isManager(session.user) : false;
  const hasLocalMembership = session
    ? hasActiveMembership(session.user)
    : false;

  useEffect(() => {
    let alive = true;

    async function checkMembership() {
      if (!token || isCurrentManager || hasLocalMembership) return;

      try {
        const user = await getMe();
        if (!alive) return;
        refreshUser(user);
        setRemoteCheck({ token, allowed: hasActiveMembership(user) });
      } catch {
        if (!alive) return;
        setRemoteCheck({ token, allowed: false });
      }
    }

    void checkMembership();

    return () => {
      alive = false;
    };
  }, [hasLocalMembership, isCurrentManager, refreshUser, token]);

  if (!session) return <Navigate to="/login" replace />;
  if (isCurrentManager) return <Navigate to="/admin" replace />;
  if (hasLocalMembership) return <Outlet />;
  if (remoteCheck.token !== session.token) return null;
  if (!remoteCheck.allowed) return <Navigate to="/payments" replace />;

  return <Outlet />;
}
