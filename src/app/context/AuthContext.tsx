/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Session } from "../../lib/types";

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

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY) ?? sessionStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);

  // remember=true (자동로그인): persists across browser restarts (localStorage)
  // remember=false: only for this tab/session (sessionStorage)
  const login = (s: Session, remember = true) => {
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem(AUTH_SESSION_KEY, JSON.stringify(s));
    other.removeItem(AUTH_SESSION_KEY);
    if (remember) {
      localStorage.setItem(AUTH_REMEMBER_KEY, "1");
    } else {
      localStorage.removeItem(AUTH_REMEMBER_KEY);
    }
    setSession(s);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_REMEMBER_KEY);
    setSession(null);
  };

  const refreshUser = (user: Session["user"]) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user };
      const store = localStorage.getItem(AUTH_SESSION_KEY) ? localStorage : sessionStorage;
      store.setItem(AUTH_SESSION_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ session, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
