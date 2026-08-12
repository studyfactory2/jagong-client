import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

export type NotificationHubDestination = "notifications" | "chat" | "notices";

type WaitingRoomNotificationHubProps = {
  open: boolean;
  unreadNotificationCount: number;
  onClose: () => void;
  onSelect: (destination: NotificationHubDestination) => void;
};

export default function WaitingRoomNotificationHub({
  open,
  unreadNotificationCount,
  onClose,
  onSelect,
}: WaitingRoomNotificationHubProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      firstOptionRef.current?.focus();
    });

    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !dialogRef.current?.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        !dialogRef.current?.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="wr-notification-hub"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="wr-notification-hub-card"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <header className="wr-notification-hub-head">
          <span aria-hidden="true" className="wr-notification-hub-symbol">
            <NotificationsNoneOutlinedIcon />
          </span>
          <div>
            <span>알림센터</span>
            <h2 id={titleId}>무엇을 확인할까요?</h2>
          </div>
          <button
            aria-label="알림센터 닫기"
            className="wr-notification-hub-close"
            onClick={onClose}
            type="button"
          >
            <CloseRoundedIcon />
          </button>
        </header>

        <p className="wr-notification-hub-description" id={descriptionId}>
          확인할 알림 종류를 선택해 주세요.
        </p>

        <div className="wr-notification-hub-options">
          <button
            aria-label={
              unreadNotificationCount > 0
                ? `관리자 알림, 읽지 않은 알림 ${unreadNotificationCount}개`
                : "관리자 알림"
            }
            className="wr-notification-hub-option is-personal"
            onClick={() => onSelect("notifications")}
            ref={firstOptionRef}
            type="button"
          >
            <span
              aria-hidden="true"
              className="wr-notification-hub-option-icon"
            >
              <NotificationsActiveOutlinedIcon />
            </span>
            <span className="wr-notification-hub-option-copy">
              <strong>관리자 알림</strong>
              <small>관리자가 나에게 보낸 개인 안내</small>
            </span>
            {unreadNotificationCount > 0 && (
              <em className="wr-notification-hub-unread">
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </em>
            )}
            <ChevronRightRoundedIcon className="wr-notification-hub-arrow" />
          </button>

          <button
            className="wr-notification-hub-option is-chat"
            onClick={() => onSelect("chat")}
            type="button"
          >
            <span
              aria-hidden="true"
              className="wr-notification-hub-option-icon"
            >
              <ForumOutlinedIcon />
            </span>
            <span className="wr-notification-hub-option-copy">
              <strong>1:1 문의</strong>
              <small>관리자와 나만 볼 수 있는 상담</small>
            </span>
            <ChevronRightRoundedIcon className="wr-notification-hub-arrow" />
          </button>

          <button
            className="wr-notification-hub-option is-notice"
            onClick={() => onSelect("notices")}
            type="button"
          >
            <span
              aria-hidden="true"
              className="wr-notification-hub-option-icon"
            >
              <CampaignOutlinedIcon />
            </span>
            <span className="wr-notification-hub-option-copy">
              <strong>전체 공지</strong>
              <small>전체 회원에게 전달된 중요 소식</small>
            </span>
            <ChevronRightRoundedIcon className="wr-notification-hub-arrow" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
