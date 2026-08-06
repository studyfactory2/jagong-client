/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Socket } from "socket.io-client";
import type {
  NoticeRecord,
  NotificationRecord,
  SessionRevokedPayload,
} from "../../lib/types";
import {
  getMyNotifications,
  markMyNotificationRead,
} from "../services/notice.service";
import { connectSocket } from "../services/socket";
import { hasActiveMembership } from "../utils/access";
import {
  armMemberAlertSound,
  clearPendingMemberAlertSound,
  playMemberAlertSound,
} from "../utils/member-alert-sound";
import { useAuth } from "./AuthContext";

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  online: number | null;
  notifications: NotificationRecord[];
  notificationLoading: boolean;
  notificationError: string;
  unreadNotificationCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<boolean>;
}

type SocketNotice = {
  id?: string;
  title: string;
  body: string;
  isBoardNotice?: boolean;
  sessionToken: string;
};

type CamWarningPayload = {
  id?: string;
  type?: string | null;
  message?: string;
  createdAt?: string;
};

function mergeNotifications(
  ...groups: NotificationRecord[][]
): NotificationRecord[] {
  const byId = new Map<string, NotificationRecord>();

  groups.flat().forEach((notification) => {
    const existing = byId.get(notification.id);
    byId.set(notification.id, {
      ...existing,
      ...notification,
      isRead: Boolean(existing?.isRead || notification.isRead),
    });
  });

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function notificationRequestError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "알림을 불러오지 못했습니다.";
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  online: null,
  notifications: [],
  notificationLoading: false,
  notificationError: "",
  unreadNotificationCount: 0,
  refreshNotifications: async () => {},
  markNotificationAsRead: async () => false,
});

// ONE socket for the whole app: connects when logged in, disconnects on logout.
// Screens read `socket` from useSocket() and attach their own listeners.
export function SocketProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navigateRef = useRef(navigate);
  const { session, logout } = useAuth();
  const shouldShowBoardNotice = session?.user.role !== "ADMIN";
  const shouldShowPersonalNotification = session?.user.role === "MEMBER";
  const canLoadNotifications =
    session?.user.role === "MEMBER" && hasActiveMembership(session.user);
  const notificationUserId = session?.user.id ?? session?.user.userId ?? "";
  const notificationOwnerKey =
    canLoadNotifications && session?.token
      ? `${notificationUserId}:${session.token}`
      : "";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<number | null>(null);
  const [warning, setWarning] = useState<{
    message: string;
    type?: string | null;
    sessionToken: string;
  } | null>(null);
  const [notice, setNotice] = useState<SocketNotice | null>(null);
  const [revocationMessage, setRevocationMessage] = useState("");
  const [notificationState, setNotificationState] = useState<{
    ownerKey: string;
    records: NotificationRecord[];
  }>({ ownerKey: "", records: [] });
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const notificationRequestRef = useRef(0);
  const notificationOwnerKeyRef = useRef(notificationOwnerKey);
  const notifications =
    notificationState.ownerKey === notificationOwnerKey
      ? notificationState.records
      : [];
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const refreshNotifications = useCallback(async () => {
    if (!notificationOwnerKey) return;

    const ownerKey = notificationOwnerKey;
    const requestId = notificationRequestRef.current + 1;
    notificationRequestRef.current = requestId;
    setNotificationState((current) =>
      current.ownerKey === ownerKey
        ? current
        : { ownerKey, records: [] },
    );
    setNotificationLoading(true);
    setNotificationError("");

    try {
      const records = await getMyNotifications();
      if (requestId !== notificationRequestRef.current) return;
      setNotificationState((current) => ({
        ownerKey,
        records: mergeNotifications(
          current.ownerKey === ownerKey ? current.records : [],
          records,
        ),
      }));
    } catch (error) {
      if (requestId !== notificationRequestRef.current) return;
      setNotificationError(notificationRequestError(error));
    } finally {
      if (requestId === notificationRequestRef.current) {
        setNotificationLoading(false);
      }
    }
  }, [notificationOwnerKey]);

  const markNotificationAsRead = useCallback(
    async (notificationId: string) => {
      if (!notificationOwnerKey) return false;

      const ownerKey = notificationOwnerKey;
      try {
        const updated = await markMyNotificationRead(notificationId);
        if (notificationOwnerKeyRef.current !== ownerKey) return true;
        setNotificationState((current) =>
          current.ownerKey === ownerKey
            ? {
                ownerKey,
                records: current.records.map((notification) =>
                  notification.id === notificationId ? updated : notification,
                ),
              }
            : current,
        );
        setNotificationError("");
        return true;
      } catch (error) {
        if (notificationOwnerKeyRef.current !== ownerKey) return false;
        setNotificationError(notificationRequestError(error));
        return false;
      }
    },
    [notificationOwnerKey],
  );

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useLayoutEffect(() => {
    notificationOwnerKeyRef.current = notificationOwnerKey;
  }, [notificationOwnerKey]);

  useEffect(() => armMemberAlertSound(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (notificationOwnerKey) {
        void refreshNotifications();
        return;
      }

      notificationRequestRef.current += 1;
      setNotificationState({ ownerKey: "", records: [] });
      setNotificationLoading(false);
      setNotificationError("");
    }, 0);

    return () => {
      window.clearTimeout(timer);
      notificationRequestRef.current += 1;
    };
  }, [notificationOwnerKey, refreshNotifications]);

  useEffect(() => {
    if (!session?.token) return;

    const sessionToken = session.token;
    const s = connectSocket(sessionToken);
    // Track the REAL connection state — `s` exists before the handshake finishes.
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("onlineCount", (d: { count: number }) => setOnline(d.count));
    const refreshAfterReconnect = () => {
      if (notificationOwnerKey) void refreshNotifications();
    };
    s.io.on("reconnect", refreshAfterReconnect);
    s.on(
      "session:revoked",
      (payload: SessionRevokedPayload, acknowledge?: () => void) => {
        try {
          if (typeof acknowledge === "function") acknowledge();
        } catch {
          // The server still forces disconnection after its acknowledgement timeout.
        }

        clearPendingMemberAlertSound();
        setSocket(null);
        setConnected(false);
        setOnline(null);
        setWarning(null);
        setNotice(null);
        setNotificationState({ ownerKey: "", records: [] });
        setNotificationLoading(false);
        setNotificationError("");
        setRevocationMessage(
          payload?.message?.trim() || "관리자에 의해 이용이 제한되었습니다.",
        );
        logout();
        navigateRef.current("/login", { replace: true });
      },
    );
    s.on("cam:warning", (payload: CamWarningPayload) => {
      const message = payload?.message?.trim();
      if (!message) return;
      const warningId =
        payload.id?.trim() ||
        payload.createdAt?.trim() ||
        `legacy:${payload.type ?? "warning"}`;
      playMemberAlertSound("warning", warningId);
      setWarning({
        message,
        type: payload.type,
        sessionToken,
      });
    });
    s.on("notice", (payload: NoticeRecord) => {
      if (!shouldShowBoardNotice) return;
      setNotice({
        id: payload.id,
        title: payload.title,
        body: payload.body,
        isBoardNotice: true,
        sessionToken,
      });
    });
    s.on("notification", (payload: NotificationRecord) => {
      if (
        !shouldShowPersonalNotification ||
        !notificationOwnerKey ||
        !payload?.id
      ) {
        return;
      }
      const notification: NotificationRecord = {
        ...payload,
        title: payload.title?.trim() || "관리자 알림",
        body: payload.body ?? "",
        type: payload.type || "GENERAL",
        isRead: Boolean(payload.isRead),
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      playMemberAlertSound("notification", notification.id);
      setNotificationState((current) => ({
        ownerKey: notificationOwnerKey,
        records: mergeNotifications(
          current.ownerKey === notificationOwnerKey ? current.records : [],
          [notification],
        ),
      }));
      setNotificationError("");
      setNotice({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        sessionToken,
      });
    });
    const socketReadyTimer = window.setTimeout(() => setSocket(s), 0);

    return () => {
      clearPendingMemberAlertSound();
      window.clearTimeout(socketReadyTimer);
      s.io.off("reconnect", refreshAfterReconnect);
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setOnline(null);
      setWarning(null);
      setNotice(null);
    };
  }, [
    logout,
    notificationOwnerKey,
    refreshNotifications,
    session?.token,
    shouldShowBoardNotice,
    shouldShowPersonalNotification,
  ]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        online,
        notifications,
        notificationLoading,
        notificationError,
        unreadNotificationCount,
        refreshNotifications,
        markNotificationAsRead,
      }}
    >
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
      {warning && warning.sessionToken === session?.token && (
        <div className="socket-warning" role="alert">
          <strong>관리자 알림</strong>
          <span>{warning.message}</span>
          <button onClick={() => setWarning(null)} type="button">
            확인
          </button>
        </div>
      )}
      {notice && notice.sessionToken === session?.token && (
        <div className="socket-notice" role="alert">
          <strong>{notice.isBoardNotice ? "새 공지" : "새 알림"}</strong>
          <span>{notice.title}</span>
          <p>{notice.body}</p>
          <div>
            <button
              onClick={() => {
                const leavingWorkroom =
                  pathname === "/study-line" || pathname === "/study-room";
                if (
                  leavingWorkroom &&
                  !window.confirm(
                    "이동하면 현재 작업장에서 퇴장합니다. 계속할까요?",
                  )
                ) {
                  return;
                }

                setNotice(null);
                if (notice.isBoardNotice) {
                  navigate("/inquiry", {
                    state: notice.id ? { noticeId: notice.id } : undefined,
                  });
                  return;
                }
                navigate("/notifications");
              }}
              type="button"
            >
              {notice.isBoardNotice ? "공지 보기" : "알림 보기"}
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
