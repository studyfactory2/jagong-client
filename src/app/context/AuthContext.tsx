/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "../../lib/types";
import {
  clearLegacyWorkdayAnnouncementClaims,
  clearWorkdayAnnouncementClaims,
} from "../utils/workroom-announcement";

interface AuthContextValue {
  session: Session | null;
  login: (s: Session, remember?: boolean) => void;
  logout: () => void;
  refreshUser: (user: Session["user"]) => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  login: () => {},
  logout: () => {},
  refreshUser: () => {},
});

const AUTH_SESSION_KEY = "jagong_session";
const AUTH_REMEMBER_KEY = "jagong_remember_login";
const AUTH_LOGOUT_SIGNAL_KEY = "jagong_auth_logout_signal";

function authOwnerFingerprint(userId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function signalSharedLogout(userId: string): void {
  if (!userId) return;
  try {
    const signal = JSON.stringify({
      nonce: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      owner: authOwnerFingerprint(userId),
    });
    localStorage.setItem(AUTH_LOGOUT_SIGNAL_KEY, signal);
    localStorage.removeItem(AUTH_LOGOUT_SIGNAL_KEY);
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

function sharedLogoutOwner(raw: string | null): string {
  if (!raw) return "";
  try {
    const value = JSON.parse(raw) as { owner?: unknown };
    return typeof value.owner === "string" ? value.owner : "";
  } catch {
    return "";
  }
}

function readSession(): Session | null {
  clearLegacyWorkdayAnnouncementClaims();
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY) ?? sessionStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

function sameUser(a: Session["user"], b: Session["user"]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);
  const sessionRef = useRef(session);

  useEffect(() => {
    const handleSharedLogout = (event: StorageEvent) => {
      const userId =
        sessionRef.current?.user.userId ?? sessionRef.current?.user.id ?? "";
      if (!userId || event.storageArea !== window.localStorage) return;
      const sharedSessionRemoved =
        event.key === AUTH_SESSION_KEY && event.newValue === null;
      const matchingLogoutSignal =
        event.key === AUTH_LOGOUT_SIGNAL_KEY &&
        sharedLogoutOwner(event.newValue) === authOwnerFingerprint(userId);
      if (!sharedSessionRemoved && !matchingLogoutSignal) return;

      clearWorkdayAnnouncementClaims(userId);
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(AUTH_REMEMBER_KEY);
      sessionRef.current = null;
      setSession(null);
    };

    window.addEventListener("storage", handleSharedLogout);
    return () => window.removeEventListener("storage", handleSharedLogout);
  }, []);

  // remember=true (자동로그인): persists across browser restarts (localStorage)
  // remember=false: only for this tab/session (sessionStorage)
  const login = useCallback((s: Session, remember = true) => {
    const previousSession = sessionRef.current;
    const previousUserId =
      previousSession?.user.userId ?? previousSession?.user.id ?? "";
    const nextUserId = s.user.userId ?? s.user.id ?? "";
    if (
      previousUserId &&
      (previousUserId !== nextUserId || previousSession?.token !== s.token)
    ) {
      clearWorkdayAnnouncementClaims(previousUserId);
    }

    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem(AUTH_SESSION_KEY, JSON.stringify(s));
    other.removeItem(AUTH_SESSION_KEY);
    if (remember) {
      localStorage.setItem(AUTH_REMEMBER_KEY, "1");
    } else {
      localStorage.removeItem(AUTH_REMEMBER_KEY);
    }
    sessionRef.current = s;
    setSession(s);
  }, []);

  const logout = useCallback(() => {
    const userId =
      sessionRef.current?.user.userId ?? sessionRef.current?.user.id ?? "";
    clearWorkdayAnnouncementClaims(userId);
    signalSharedLogout(userId);
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_REMEMBER_KEY);
    sessionRef.current = null;
    setSession(null);
  }, []);

  const refreshUser = useCallback((user: Session["user"]) => {
    setSession((current) => {
      if (!current) return current;
      if (sameUser(current.user, user)) return current;
      const next = { ...current, user };
      const store = localStorage.getItem(AUTH_SESSION_KEY) ? localStorage : sessionStorage;
      store.setItem(AUTH_SESSION_KEY, JSON.stringify(next));
      sessionRef.current = next;
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ session, login, logout, refreshUser }),
    [login, logout, refreshUser, session],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
