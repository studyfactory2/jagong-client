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
import { setHttpAuthToken } from "../services/http";
import {
  clearObsoleteWorkdayAnnouncementClaims,
  invalidateWorkdayAnnouncementRuntime,
  workdayAnnouncementOwnerFingerprint,
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
const AUTH_LOCAL_FALLBACK_BLOCK_KEY =
  "jagong_local_session_fallback_blocked";
let localFallbackBlockedInMemory = false;

type AuthStorageSource = "local" | "session";
type AuthSessionSource = AuthStorageSource | "memory";

type AuthState = {
  session: Session | null;
  source: AuthSessionSource | null;
};

const EMPTY_AUTH_STATE: AuthState = { session: null, source: null };

function authStorage(source: AuthStorageSource): Storage | null {
  try {
    return source === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function readStorageValue(
  source: AuthStorageSource,
  key: string,
): string | null | undefined {
  try {
    return authStorage(source)?.getItem(key);
  } catch {
    return undefined;
  }
}

function writeStorageValue(
  source: AuthStorageSource,
  key: string,
  value: string,
): boolean {
  try {
    const storage = authStorage(source);
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorageValue(source: AuthStorageSource, key: string): void {
  try {
    authStorage(source)?.removeItem(key);
  } catch {
    // The in-memory auth state still has to be cleared when storage is blocked.
  }
}

function signalSharedLogout(userId: string): void {
  if (!userId) return;
  try {
    const signal = JSON.stringify({
      nonce: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      owner: workdayAnnouncementOwnerFingerprint(userId),
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

function sessionUserId(session: Session | null | undefined): string {
  return session?.user.userId ?? session?.user.id ?? "";
}

function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<Session> | null;
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.token !== "string" ||
      !value.token ||
      !value.user ||
      typeof value.user !== "object"
    ) {
      return null;
    }

    const userId = value.user.userId ?? value.user.id;
    return typeof userId === "string" && userId
      ? (value as Session)
      : null;
  } catch {
    return null;
  }
}

function storedSession(
  source: AuthStorageSource,
): Session | null | undefined {
  const raw = readStorageValue(source, AUTH_SESSION_KEY);
  return raw === undefined ? undefined : parseStoredSession(raw);
}

function blockLocalFallbackForThisTab(): void {
  localFallbackBlockedInMemory = true;
  writeStorageValue("session", AUTH_LOCAL_FALLBACK_BLOCK_KEY, "1");
}

function allowLocalFallbackForThisTab(): void {
  localFallbackBlockedInMemory = false;
  removeStorageValue("session", AUTH_LOCAL_FALLBACK_BLOCK_KEY);
}

export function isLocalAuthFallbackBlockedForThisTab(): boolean {
  return (
    localFallbackBlockedInMemory ||
    readStorageValue("session", AUTH_LOCAL_FALLBACK_BLOCK_KEY) === "1"
  );
}

function removeStoredSessionForUser(
  source: AuthStorageSource,
  userId: string,
): boolean {
  if (!userId) return false;
  const stored = storedSession(source);
  if (sessionUserId(stored) !== userId) return false;
  removeStorageValue(source, AUTH_SESSION_KEY);
  return true;
}

function sameSessionIdentity(a: Session, b: Session): boolean {
  return a.token === b.token && sessionUserId(a) === sessionUserId(b);
}

function readAuthState(): AuthState {
  const tabRaw = readStorageValue("session", AUTH_SESSION_KEY);
  if (tabRaw !== null && tabRaw !== undefined) {
    const tabSession = parseStoredSession(tabRaw);
    if (tabSession) return { session: tabSession, source: "session" };

    removeStorageValue("session", AUTH_SESSION_KEY);
    blockLocalFallbackForThisTab();
    return EMPTY_AUTH_STATE;
  }

  if (isLocalAuthFallbackBlockedForThisTab()) {
    localFallbackBlockedInMemory = true;
    return EMPTY_AUTH_STATE;
  }

  const localRaw = readStorageValue("local", AUTH_SESSION_KEY);
  if (localRaw === null || localRaw === undefined) return EMPTY_AUTH_STATE;
  const localSession = parseStoredSession(localRaw);
  if (localSession) return { session: localSession, source: "local" };

  removeStorageValue("local", AUTH_SESSION_KEY);
  removeStorageValue("local", AUTH_REMEMBER_KEY);
  return EMPTY_AUTH_STATE;
}

function readInitialAuthState(): AuthState {
  const state = readAuthState();
  setHttpAuthToken(state.session?.token ?? null);
  return state;
}

function sameUser(a: Session["user"], b: Session["user"]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(readInitialAuthState);
  const authStateRef = useRef(authState);
  const session = authState.session;

  const adoptAuthState = useCallback((next: AuthState) => {
    authStateRef.current = next;
    setHttpAuthToken(next.session?.token ?? null);
    setAuthState(next);
  }, []);

  useEffect(() => {
    clearObsoleteWorkdayAnnouncementClaims();
  }, []);

  useEffect(() => {
    const handleSharedLogout = (event: StorageEvent) => {
      const current = authStateRef.current;
      const userId = sessionUserId(current.session);
      const localStore = authStorage("local");
      if (!userId || !localStore || event.storageArea !== localStore) return;
      const matchingLogoutSignal =
        event.key === AUTH_LOGOUT_SIGNAL_KEY &&
        sharedLogoutOwner(event.newValue) ===
          workdayAnnouncementOwnerFingerprint(userId);
      if (matchingLogoutSignal) {
        blockLocalFallbackForThisTab();
        invalidateWorkdayAnnouncementRuntime(userId);
        removeStoredSessionForUser("session", userId);
        if (removeStoredSessionForUser("local", userId)) {
          removeStorageValue("local", AUTH_REMEMBER_KEY);
        }
        adoptAuthState(EMPTY_AUTH_STATE);
        return;
      }

      if (current.source !== "local") return;
      const localSessionChanged = event.key === AUTH_SESSION_KEY;
      const localStorageCleared = event.key === null;
      if (!localSessionChanged && !localStorageCleared) return;

      if (localStorageCleared || event.newValue === null) {
        const previous = parseStoredSession(event.oldValue);
        if (
          previous &&
          current.session &&
          !sameSessionIdentity(previous, current.session)
        ) {
          return;
        }
        blockLocalFallbackForThisTab();
        invalidateWorkdayAnnouncementRuntime(userId);
        adoptAuthState(EMPTY_AUTH_STATE);
        return;
      }

      const nextSession = parseStoredSession(event.newValue);
      if (!nextSession) {
        blockLocalFallbackForThisTab();
        invalidateWorkdayAnnouncementRuntime(userId);
        removeStorageValue("local", AUTH_SESSION_KEY);
        removeStorageValue("local", AUTH_REMEMBER_KEY);
        adoptAuthState(EMPTY_AUTH_STATE);
        return;
      }

      if (current.session && sameSessionIdentity(current.session, nextSession)) {
        adoptAuthState({ session: nextSession, source: "local" });
        return;
      }

      invalidateWorkdayAnnouncementRuntime(userId);
      adoptAuthState({ session: nextSession, source: "local" });
      window.location.reload();
    };

    window.addEventListener("storage", handleSharedLogout);
    return () => window.removeEventListener("storage", handleSharedLogout);
  }, [adoptAuthState]);

  // remember=true (자동로그인): persists across browser restarts (localStorage)
  // remember=false: only for this tab/session (sessionStorage)
  const login = useCallback((s: Session, remember = true) => {
    const previousSession = authStateRef.current.session;
    const previousUserId = sessionUserId(previousSession);
    const nextUserId = sessionUserId(s);
    if (
      previousUserId &&
      (previousUserId !== nextUserId || previousSession?.token !== s.token)
    ) {
      invalidateWorkdayAnnouncementRuntime(previousUserId);
    }

    const serialized = JSON.stringify(s);
    let source: AuthSessionSource = "memory";
    if (remember && writeStorageValue("local", AUTH_SESSION_KEY, serialized)) {
      allowLocalFallbackForThisTab();
      removeStorageValue("session", AUTH_SESSION_KEY);
      writeStorageValue("local", AUTH_REMEMBER_KEY, "1");
      source = "local";
    } else if (!remember) {
      blockLocalFallbackForThisTab();
      if (writeStorageValue("session", AUTH_SESSION_KEY, serialized)) {
        source = "session";
      } else {
        removeStorageValue("session", AUTH_SESSION_KEY);
      }
    } else {
      blockLocalFallbackForThisTab();
      removeStorageValue("session", AUTH_SESSION_KEY);
    }
    adoptAuthState({ session: s, source });
  }, [adoptAuthState]);

  const logout = useCallback(() => {
    const current = authStateRef.current;
    const userId = sessionUserId(current.session);
    blockLocalFallbackForThisTab();
    invalidateWorkdayAnnouncementRuntime(userId);
    removeStoredSessionForUser("session", userId);
    if (removeStoredSessionForUser("local", userId)) {
      removeStorageValue("local", AUTH_REMEMBER_KEY);
    }
    signalSharedLogout(userId);
    adoptAuthState(EMPTY_AUTH_STATE);
  }, [adoptAuthState]);

  const refreshUser = useCallback((user: Session["user"]) => {
    const current = authStateRef.current;
    if (!current.session || !current.source) return;
    if (sameUser(current.session.user, user)) return;

    const next = { ...current.session, user };
    if (current.source === "memory") {
      adoptAuthState({ session: next, source: "memory" });
      return;
    }

    const stored = storedSession(current.source);
    if (stored === undefined) {
      writeStorageValue(current.source, AUTH_SESSION_KEY, JSON.stringify(next));
      adoptAuthState({ session: next, source: current.source });
      return;
    }

    if (!stored || !sameSessionIdentity(stored, current.session)) {
      if (current.source === "local" && stored) {
        invalidateWorkdayAnnouncementRuntime(
          sessionUserId(current.session),
        );
        adoptAuthState({ session: stored, source: "local" });
        window.location.reload();
        return;
      }

      blockLocalFallbackForThisTab();
      adoptAuthState(EMPTY_AUTH_STATE);
      return;
    }

    writeStorageValue(current.source, AUTH_SESSION_KEY, JSON.stringify(next));
    adoptAuthState({ session: next, source: current.source });
  }, [adoptAuthState]);

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
