import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { connectSocket } from "../services/socket";
import { useAuth } from "./AuthContext";

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  online: number | null;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  online: null,
});

// ONE socket for the whole app: connects when logged in, disconnects on logout.
// Screens read `socket` from useSocket() and attach their own listeners.
export function SocketProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<number | null>(null);
  const [warning, setWarning] = useState<{ message: string; type?: string | null } | null>(null);

  useEffect(() => {
    if (!session) {
      setSocket(null);
      setConnected(false);
      setOnline(null);
      return;
    }

    const s = connectSocket(session.token);
    // Track the REAL connection state — `s` exists before the handshake finishes.
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("onlineCount", (d: { count: number }) => setOnline(d.count));
    s.on("cam:warning", (payload: { message: string; type?: string | null }) => {
      setWarning({ message: payload.message, type: payload.type });
    });
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [session?.token]);

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
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
