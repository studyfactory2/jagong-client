import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/auth.service";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { session, logout, refreshUser } = useAuth();
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function verify() {
      if (!session) return;

      try {
        const user = await getMe();
        if (!alive) return;
        refreshUser(user);
        setVerifiedToken(session.token);
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
  }, [session?.token]);

  if (!session) return <Navigate to="/login" replace />;
  if (verifiedToken !== session.token) return null;

  return <Outlet />;
}
