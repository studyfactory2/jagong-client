/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { Socket } from "socket.io-client";
import type { NoticeRecord } from "../../lib/types";
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
  const { session } = useAuth();
  const shouldShowUserNotice = session?.user.role !== "ADMIN";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<number | null>(null);
  const [warning, setWarning] = useState<{
    message: string;
    type?: string | null;
  } | null>(null);
  const [notice, setNotice] = useState<SocketNotice | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    const s = connectSocket(session.token);
    // Track the REAL connection state — `s` exists before the handshake finishes.
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("onlineCount", (d: { count: number }) => setOnline(d.count));
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
  }, [session?.token, shouldShowUserNotice]);

  return (
    <SocketContext.Provider value={{ socket, connected, online }}>
      {children}
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
