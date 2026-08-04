/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { Socket } from "socket.io-client";
import type { NoticeRecord, SessionRevokedPayload } from "../../lib/types";
import { connectSocket } from "../services/socket";
import { useAuth } from "./AuthContext";

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  online: number | null;
}

type SocketNotice = {
  id?: string;
  title: string;
  body: string;
  isBoardNotice?: boolean;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  online: null,
});

// ONE socket for the whole app: connects when logged in, disconnects on logout.
// Screens read `socket` from useSocket() and attach their own listeners.
export function SocketProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const { session, logout } = useAuth();
  const shouldShowUserNotice = session?.user.role !== "ADMIN";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<number | null>(null);
  const [warning, setWarning] = useState<{
    message: string;
    type?: string | null;
  } | null>(null);
  const [notice, setNotice] = useState<SocketNotice | null>(null);
  const [revocationMessage, setRevocationMessage] = useState("");

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!session?.token) return;

    const s = connectSocket(session.token);
    // Track the REAL connection state — `s` exists before the handshake finishes.
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("onlineCount", (d: { count: number }) => setOnline(d.count));
    s.on(
      "session:revoked",
      (payload: SessionRevokedPayload, acknowledge?: () => void) => {
        try {
          if (typeof acknowledge === "function") acknowledge();
        } catch {
          // The server still forces disconnection after its acknowledgement timeout.
        }

        setSocket(null);
        setConnected(false);
        setOnline(null);
        setWarning(null);
        setNotice(null);
        setRevocationMessage(
          payload?.message?.trim() ||
            "관리자에 의해 이용이 제한되었습니다.",
        );
        logout();
        navigateRef.current("/login", { replace: true });
      },
    );
    s.on("cam:warning", (payload: { message: string; type?: string | null }) => {
      setWarning({ message: payload.message, type: payload.type });
    });
    s.on("notice", (payload: NoticeRecord) => {
      if (!shouldShowUserNotice) return;
      setNotice({
        id: payload.id,
        title: payload.title,
        body: payload.body,
        isBoardNotice: true,
      });
    });
    s.on("notification", (payload: { id?: string; title?: string; body?: string }) => {
      if (!shouldShowUserNotice) return;
      setNotice({
        id: payload.id,
        title: payload.title ?? "관리자 알림",
        body: payload.body ?? "",
      });
    });
    const socketReadyTimer = window.setTimeout(() => setSocket(s), 0);

    return () => {
      window.clearTimeout(socketReadyTimer);
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setOnline(null);
    };
  }, [logout, session?.token, shouldShowUserNotice]);

  return (
    <SocketContext.Provider value={{ socket, connected, online }}>
      {children}
      {revocationMessage && (
        <div className="socket-warning" role="alert">
          <strong>이용 제한 안내</strong>
          <span>{revocationMessage}</span>
          <button onClick={() => setRevocationMessage("")} type="button">
            확인
          </button>
        </div>
      )}
      {warning && (
        <div className="socket-warning" role="alert">
          <strong>관리자 알림</strong>
          <span>{warning.message}</span>
          <button onClick={() => setWarning(null)} type="button">
            확인
          </button>
        </div>
      )}
      {notice && (
        <div className="socket-notice" role="alert">
          <strong>새 공지</strong>
          <span>{notice.title}</span>
          <p>{notice.body}</p>
          <div>
            <button
              onClick={() => {
                setNotice(null);
                navigate("/inquiry", {
                  state:
                    notice.isBoardNotice && notice.id
                      ? { noticeId: notice.id }
                      : undefined,
                });
              }}
              type="button"
            >
              {notice.isBoardNotice ? "공지 보기" : "문의함 보기"}
            </button>
            <button onClick={() => setNotice(null)} type="button">
              닫기
            </button>
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
