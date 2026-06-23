import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/auth.service";
import { useAuth } from "../context/AuthContext";

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
  if (verifiedToken !== session.token) return null;

  return <Outlet />;
}
