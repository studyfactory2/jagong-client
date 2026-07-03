import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/auth.service";
import { useAuth } from "../context/AuthContext";
import AppLoading from "./ui/AppLoading";

export default function ProtectedRoute() {
  const { session, logout, refreshUser } = useAuth();
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const token = session?.token ?? null;

  useEffect(() => {
    let alive = true;

    async function verify() {
      if (!token) return;

      try {
        const user = await getMe();
        if (!alive) return;
        refreshUser(user);
        setVerifiedToken(token);
      } catch {
        if (!alive) return;
        logout();
        setVerifiedToken(null);
      }
    }

    verify();

    return () => {
      alive = false;
    };
  }, [logout, refreshUser, token]);

  if (!session) return <Navigate to="/login" replace />;
  if (verifiedToken !== session.token) {
    return <AppLoading message="로그인 상태를 확인하고 있습니다." />;
  }

  return <Outlet />;
}
