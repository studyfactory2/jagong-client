import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { session, logout, refreshUser } = useAuth();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let alive = true;

    async function verify() {
      if (!session) {
        setVerified(false);
        return;
      }

      try {
        const user = await getMe();
        if (!alive) return;
        refreshUser(user);
        setVerified(true);
      } catch {
        if (!alive) return;
        logout();
        setVerified(false);
      }
    }

    setVerified(false);
    verify();

    return () => {
      alive = false;
    };
  }, [session?.token]);

  if (!session) return <Navigate to="/login" replace />;
  if (!verified) return null;

  return <Outlet />;
}
