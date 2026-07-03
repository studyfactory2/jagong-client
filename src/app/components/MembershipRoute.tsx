import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/auth.service";
import { useAuth } from "../context/AuthContext";
import { hasActiveMembership, isManager } from "../utils/access";
import AppLoading from "./ui/AppLoading";

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
  if (remoteCheck.token !== session.token) {
    return <AppLoading message="이용권 상태를 확인하고 있습니다." />;
  }
  if (!remoteCheck.allowed) return <Navigate to="/payments" replace />;

  return <Outlet />;
}
