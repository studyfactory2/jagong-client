import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { useSocket } from "../../context/SocketContext";
import type { NotificationRecord } from "../../../lib/types";
import "./notifications.css";

const notificationDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function notificationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "시간 확인 중"
    : notificationDateFormatter.format(date);
}

function notificationTypeLabel(notification: NotificationRecord): string {
  if (notification.type === "MEMBERSHIP") return "이용권";
  return "개인 알림";
}

export default function Notifications() {
  const navigate = useNavigate();
  const {
    notifications,
    notificationLoading,
    notificationError,
    unreadNotificationCount,
    refreshNotifications,
    markNotificationAsRead,
  } = useSocket();
  const [markingId, setMarkingId] = useState("");
  const [expandedId, setExpandedId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshNotifications();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshNotifications]);

  const handleRead = async (notificationId: string) => {
    if (markingId) return;
    setMarkingId(notificationId);
    await markNotificationAsRead(notificationId);
    setMarkingId("");
  };

  const handleToggle = async (notification: NotificationRecord) => {
    const opening = expandedId !== notification.id;
    setExpandedId(opening ? notification.id : "");

    if (opening && !notification.isRead) {
      await handleRead(notification.id);
    }
  };

  return (
    <div className="nt">
      <header className="nt-head">
        <button onClick={() => navigate("/waiting-room")} type="button">
          <ArrowBackRoundedIcon /> 대기장
        </button>
        <h1>내 알림</h1>
        <button
          aria-label="알림 새로고침"
          className="nt-refresh"
          disabled={notificationLoading}
          onClick={() => void refreshNotifications()}
          title="새로고침"
          type="button"
        >
          <RefreshRoundedIcon />
        </button>
      </header>

      <main className="nt-body">
        <section className="nt-summary">
          <span aria-hidden="true" className="nt-summary-icon">
            <NotificationsNoneRoundedIcon />
          </span>
          <div>
            <strong>
              {unreadNotificationCount > 0
                ? `읽지 않은 알림 ${unreadNotificationCount}개`
                : "모든 알림을 확인했습니다"}
            </strong>
            <p>관리자가 보낸 개인 안내와 이용권 알림을 확인할 수 있습니다.</p>
          </div>
        </section>

        {notificationError && (
          <section aria-live="assertive" className="nt-error" role="alert">
            <span>{notificationError}</span>
            <button
              disabled={notificationLoading}
              onClick={() => void refreshNotifications()}
              type="button"
            >
              다시 시도
            </button>
          </section>
        )}

        {notificationLoading && notifications.length === 0 && (
          <p aria-live="polite" className="nt-state">
            알림을 불러오는 중입니다.
          </p>
        )}

        {!notificationLoading &&
          !notificationError &&
          notifications.length === 0 && (
            <section className="nt-empty">
              <NotificationsNoneRoundedIcon />
              <strong>아직 도착한 알림이 없습니다.</strong>
              <p>새로운 개인 안내가 도착하면 이곳에 안전하게 보관됩니다.</p>
            </section>
          )}

        {notifications.length > 0 && (
          <section aria-label="개인 알림 목록" className="nt-list">
            {notifications.map((notification) => (
              <article
                className={`nt-card${notification.isRead ? "" : " is-unread"}`}
                key={notification.id}
              >
                <header>
                  <span>{notificationTypeLabel(notification)}</span>
                  <time dateTime={notification.createdAt}>
                    <ScheduleRoundedIcon />
                    {notificationDate(notification.createdAt)}
                  </time>
                </header>
                <button
                  aria-controls={`nt-notification-${notification.id}`}
                  aria-expanded={expandedId === notification.id}
                  className={`nt-card-toggle${
                    expandedId === notification.id ? " is-open" : ""
                  }`}
                  disabled={
                    Boolean(markingId) && markingId !== notification.id
                  }
                  onClick={() => void handleToggle(notification)}
                  type="button"
                >
                  <span>
                    {!notification.isRead && <i aria-hidden="true" />}
                    <strong>{notification.title}</strong>
                  </span>
                  <ExpandMoreRoundedIcon />
                </button>
                {expandedId === notification.id && (
                  <div
                    className="nt-card-detail"
                    id={`nt-notification-${notification.id}`}
                  >
                    <p>{notification.body}</p>
                    <footer>
                      <span
                        className={`nt-read-state${
                          notification.isRead ? "" : " is-unread"
                        }`}
                      >
                        {notification.isRead ? (
                          <DoneAllRoundedIcon />
                        ) : (
                          <i aria-hidden="true" />
                        )}
                        {markingId === notification.id
                          ? "확인 중…"
                          : notification.isRead
                            ? "읽음"
                            : "읽지 않음"}
                      </span>
                    </footer>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
