import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/auth.service";
import { useAuth } from "../context/AuthContext";
import { hasActiveMembership, isManager } from "../utils/access";

export default function MembershipRoute() {
  const { session, refreshUser } = useAuth();
  const [checkedToken, setCheckedToken] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const token = session?.token ?? null;

  useEffect(() => {
    let alive = true;

    async function checkMembership() {
      if (!session) return;

      if (isManager(session.user)) {
        setAllowed(false);
        setCheckedToken(session.token);
        return;
      }

      if (hasActiveMembership(session.user)) {
        setAllowed(true);
        setCheckedToken(session.token);
        return;
      }

      try {
        const user = await getMe();
        if (!alive) return;
        refreshUser(user);
        setAllowed(hasActiveMembership(user));
      } catch {
        if (!alive) return;
        setAllowed(false);
      } finally {
        if (alive) setCheckedToken(session.token);
      }
    }

    void checkMembership();

    return () => {
      alive = false;
    };
  }, [refreshUser, session, token]);

  if (!session) return <Navigate to="/login" replace />;
  if (checkedToken !== session.token) return null;
  if (isManager(session.user)) return <Navigate to="/admin" replace />;
  if (!allowed) return <Navigate to="/payments" replace />;

  return <Outlet />;
}
