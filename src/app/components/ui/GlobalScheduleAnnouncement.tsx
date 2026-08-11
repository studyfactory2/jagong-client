import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { hasActiveMembership } from "../../utils/access";
import {
  armScheduleSound,
  getScheduleSoundEnabled,
  getWorkdayAnnouncement,
  playScheduleTone,
  type ScheduleBellEvent,
  type WorkdayAnnouncement,
} from "../../utils/schedule-bell";
import "./global-schedule-announcement.css";

type ActiveAnnouncement = {
  claimKey: string;
  userId: string;
  announcement: WorkdayAnnouncement;
};

export default function GlobalScheduleAnnouncement() {
  const { session } = useAuth();
  const { socket } = useSocket();
  const [active, setActive] = useState<ActiveAnnouncement | null>(null);
  const seenClaimsRef = useRef(new Set<string>());
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const userId = session?.user.userId ?? session?.user.id ?? "";
  const isEligibleMember = Boolean(
    session?.user.role === "MEMBER" &&
      userId &&
      session.user.isActive !== false &&
      session.user.memberStatus !== "BLOCKED" &&
      hasActiveMembership(session.user),
  );
  const visibleAnnouncement =
    isEligibleMember && active?.userId === userId ? active : null;

  useEffect(() => armScheduleSound(), []);

  useEffect(() => {
    if (!isEligibleMember || !socket) return;

    const onBell = (event: ScheduleBellEvent) => {
      if (
        !session ||
        session.user.isActive === false ||
        session.user.memberStatus === "BLOCKED" ||
        !hasActiveMembership(session.user)
      ) {
        return;
      }

      const announcement = getWorkdayAnnouncement(event);
      if (!announcement) return;

      const claimKey = `${userId}:${announcement.id}`;
      if (seenClaimsRef.current.has(claimKey)) return;
      seenClaimsRef.current.add(claimKey);

      if (getScheduleSoundEnabled()) playScheduleTone(event.type);
      setActive({ announcement, claimKey, userId });
    };

    socket.on("bell", onBell);
    return () => {
      socket.off("bell", onBell);
    };
  }, [isEligibleMember, session, socket, userId]);

  useEffect(() => {
    if (!visibleAnnouncement) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      confirmButtonRef.current?.focus();
    });

    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [visibleAnnouncement]);

  if (!visibleAnnouncement) return null;

  const { announcement } = visibleAnnouncement;
  const timeLabel =
    announcement.kind === "WORKDAY_START" ? "09:00" : "22:00";

  return createPortal(
    <div className="global-schedule-announcement" role="presentation">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="global-schedule-announcement__dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setActive(null);
            return;
          }
          if (event.key === "Tab") {
            event.preventDefault();
            confirmButtonRef.current?.focus();
          }
        }}
        role="dialog"
      >
        <span className="global-schedule-announcement__time">
          {timeLabel}
        </span>
        <strong id={titleId}>{announcement.title}</strong>
        <div
          className="global-schedule-announcement__body"
          id={descriptionId}
        >
          {announcement.body.map((line, index) => (
            <p key={`${visibleAnnouncement.claimKey}:body:${index}`}>
              {line}
            </p>
          ))}
          <p className="global-schedule-announcement__note">
            {announcement.note}
          </p>
        </div>
        <button
          onClick={() => setActive(null)}
          ref={confirmButtonRef}
          type="button"
        >
          확인
        </button>
      </section>
    </div>,
    document.body,
  );
}
