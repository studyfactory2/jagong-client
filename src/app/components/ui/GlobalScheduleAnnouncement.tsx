import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useHasJoinedWorkroomSession } from "../../context/WorkroomAnnouncementRuntimeContext";
import { useSocket } from "../../context/SocketContext";
import { hasActiveMembership } from "../../utils/access";
import {
  armScheduleSound,
  getScheduleSoundEnabled,
  getWorkdayAnnouncement,
  playScheduleTone,
  type ScheduleBellEvent,
} from "../../utils/schedule-bell";
import {
  claimWorkdayAnnouncementSound,
  commitWorkdayAnnouncementDisplay,
  createWorkroomAnnouncementIntent,
  createWorkroomAnnouncementIntentState,
  isWorkdayAnnouncementDisplayReservationCurrent,
  presentLiveWorkdayAnnouncement,
  releaseWorkdayAnnouncementDisplay,
  reserveWorkdayAnnouncementDisplay,
  resolveFreshEntryAnnouncement,
  WORKDAY_ANNOUNCEMENT_RESERVATION_RETRY_MS,
  type WorkdayAnnouncementDisplayReservation,
  type WorkroomAnnouncementPresentation,
} from "../../utils/workroom-announcement";
import "./global-schedule-announcement.css";

type ActiveAnnouncement = {
  claimKey: string;
  committed: boolean;
  ownerKey: string;
  presentation: WorkroomAnnouncementPresentation;
  reservation: WorkdayAnnouncementDisplayReservation;
  userId: string;
};

type QueuedAnnouncement = {
  ownerKey: string;
  presentation: WorkroomAnnouncementPresentation;
};

function announcementActionTarget(pathname: string, search: string): string {
  if (pathname === "/study-line" || pathname === "/study-room") {
    return `${pathname}${search}`;
  }
  if (pathname === "/workroom/prepare") {
    const mode = new URLSearchParams(search).get("mode");
    return mode === "line" || mode === "group"
      ? `${pathname}${search}`
      : `${pathname}?mode=line`;
  }
  return "/workroom/prepare?mode=line";
}

function runtimeOwnerKey(userId: string, sessionToken: string): string {
  let hash = 2166136261;
  for (let index = 0; index < sessionToken.length; index += 1) {
    hash ^= sessionToken.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${userId}:${(hash >>> 0).toString(36)}`;
}

export default function GlobalScheduleAnnouncement() {
  const { session } = useAuth();
  const { socket } = useSocket();
  const hasJoinedWorkroomSession = useHasJoinedWorkroomSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveAnnouncement | null>(null);
  const activeRef = useRef<ActiveAnnouncement | null>(null);
  const mountedRef = useRef(true);
  const inFlightPresentationKeysRef = useRef(new Set<string>());
  const presentationRetryTimersRef = useRef(new Map<string, number>());
  const retriedPresentationKeysRef = useRef(new Set<string>());
  const queuedPresentationRef = useRef<QueuedAnnouncement | null>(null);
  const requestPresentationRef = useRef<
    (presentation: WorkroomAnnouncementPresentation) => void
  >(() => undefined);
  const settledPresentationKeysRef = useRef(new Set<string>());
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const secondaryButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const userId = session?.user.userId ?? session?.user.id ?? "";
  const ownerKey =
    userId && session?.token ? runtimeOwnerKey(userId, session.token) : "";
  const isEligibleMember = Boolean(
    session?.user.role === "MEMBER" &&
    userId &&
    session.user.isActive !== false &&
    session.user.memberStatus !== "BLOCKED" &&
    hasActiveMembership(session.user),
  );
  const currentOwnerRef = useRef({
    hasJoinedWorkroomSession,
    isEligibleMember,
    ownerKey,
    userId,
  });
  const visibleAnnouncement =
    isEligibleMember && active?.ownerKey === ownerKey ? active : null;

  useLayoutEffect(() => {
    currentOwnerRef.current = {
      hasJoinedWorkroomSession,
      isEligibleMember,
      ownerKey,
      userId,
    };
  }, [hasJoinedWorkroomSession, isEligibleMember, ownerKey, userId]);

  useEffect(() => {
    const retryTimers = presentationRetryTimersRef.current;
    const retriedKeys = retriedPresentationKeysRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      retryTimers.forEach((timer) => {
        window.clearTimeout(timer);
      });
      retryTimers.clear();
      retriedKeys.clear();
      queuedPresentationRef.current = null;
      const current = activeRef.current;
      if (current && !current.committed) {
        void releaseWorkdayAnnouncementDisplay(
          current.userId,
          current.reservation,
        );
      }
    };
  }, []);

  useEffect(() => armScheduleSound(), []);

  const clearActive = useCallback((claimKey?: string) => {
    const current = activeRef.current;
    if (!current || (claimKey && current.claimKey !== claimKey)) return;
    activeRef.current = null;
    setActive(null);
  }, []);

  const requestPresentation = useCallback(
    (presentation: WorkroomAnnouncementPresentation) => {
      if (!isEligibleMember || !ownerKey || !userId) return;
      const claimKey = `${ownerKey}:${presentation.announcement.id}`;
      if (
        settledPresentationKeysRef.current.has(claimKey) ||
        inFlightPresentationKeysRef.current.has(claimKey)
      ) {
        return;
      }
      if (activeRef.current) {
        if (activeRef.current.claimKey !== claimKey) {
          queuedPresentationRef.current = { ownerKey, presentation };
        }
        return;
      }

      inFlightPresentationKeysRef.current.add(claimKey);
      void reserveWorkdayAnnouncementDisplay(
        userId,
        presentation.announcement.id,
      )
        .then((claim) => {
          const currentOwner = currentOwnerRef.current;
          const startSuppressed =
            presentation.intentKind === "START_STUDY" &&
            currentOwner.hasJoinedWorkroomSession;
          const reservationIsCurrent =
            claim?.status !== "reserved" ||
            isWorkdayAnnouncementDisplayReservationCurrent(
              userId,
              claim.reservation,
            );
          if (
            !mountedRef.current ||
            !currentOwner.isEligibleMember ||
            currentOwner.ownerKey !== ownerKey ||
            currentOwner.userId !== userId ||
            document.visibilityState !== "visible" ||
            startSuppressed ||
            !reservationIsCurrent
          ) {
            if (claim?.status === "reserved") {
              void releaseWorkdayAnnouncementDisplay(
                userId,
                claim.reservation,
              );
            }
            if (startSuppressed) {
              settledPresentationKeysRef.current.add(claimKey);
            }
            return;
          }

          if (claim?.status === "claimed") {
            settledPresentationKeysRef.current.add(claimKey);
            return;
          }
          if (!claim) {
            if (
              !retriedPresentationKeysRef.current.has(claimKey) &&
              !presentationRetryTimersRef.current.has(claimKey)
            ) {
              retriedPresentationKeysRef.current.add(claimKey);
              const retryTimer = window.setTimeout(() => {
                presentationRetryTimersRef.current.delete(claimKey);
                const retryOwner = currentOwnerRef.current;
                if (
                  mountedRef.current &&
                  document.visibilityState === "visible" &&
                  retryOwner.isEligibleMember &&
                  retryOwner.ownerKey === ownerKey &&
                  retryOwner.userId === userId
                ) {
                  requestPresentationRef.current(
                    resolveFreshEntryAnnouncement(new Date()),
                  );
                }
              }, WORKDAY_ANNOUNCEMENT_RESERVATION_RETRY_MS);
              presentationRetryTimersRef.current.set(claimKey, retryTimer);
            }
            return;
          }
          if (claim.status !== "reserved") return;

          if (activeRef.current) {
            if (activeRef.current.claimKey !== claimKey) {
              queuedPresentationRef.current = { ownerKey, presentation };
            }
            void releaseWorkdayAnnouncementDisplay(
              userId,
              claim.reservation,
            );
            return;
          }

          const next: ActiveAnnouncement = {
            claimKey,
            committed: false,
            ownerKey,
            presentation,
            reservation: claim.reservation,
            userId,
          };
          activeRef.current = next;
          setActive(next);
        })
        .finally(() => {
          inFlightPresentationKeysRef.current.delete(claimKey);
        });
    },
    [isEligibleMember, ownerKey, userId],
  );

  useLayoutEffect(() => {
    requestPresentationRef.current = requestPresentation;
  }, [requestPresentation]);

  useEffect(() => {
    if (active) return;
    const queued = queuedPresentationRef.current;
    if (!queued) return;
    queuedPresentationRef.current = null;
    if (
      queued.ownerKey === ownerKey &&
      document.visibilityState === "visible"
    ) {
      requestPresentation(queued.presentation);
    }
  }, [active, ownerKey, requestPresentation]);

  useEffect(() => {
    if (!isEligibleMember || !userId) return;

    const evaluateFreshEntry = () => {
      if (document.visibilityState !== "visible") return;
      const presentation = resolveFreshEntryAnnouncement(new Date());
      const claimKey = `${ownerKey}:${presentation.announcement.id}`;
      if (
        presentation.intentKind === "START_STUDY" &&
        hasJoinedWorkroomSession
      ) {
        settledPresentationKeysRef.current.add(claimKey);
        const current = activeRef.current;
        if (current?.claimKey === claimKey) {
          window.setTimeout(() => {
            clearActive(claimKey);
            if (!current.committed) {
              void releaseWorkdayAnnouncementDisplay(
                current.userId,
                current.reservation,
              );
            }
          }, 0);
        }
        return;
      }

      requestPresentation(presentation);
    };

    evaluateFreshEntry();
    document.addEventListener("visibilitychange", evaluateFreshEntry);
    return () => {
      document.removeEventListener("visibilitychange", evaluateFreshEntry);
    };
  }, [
    clearActive,
    hasJoinedWorkroomSession,
    isEligibleMember,
    ownerKey,
    requestPresentation,
    userId,
  ]);

  useEffect(() => {
    const settledKeys = settledPresentationKeysRef.current;
    const retryTimers = presentationRetryTimersRef.current;
    const retriedKeys = retriedPresentationKeysRef.current;
    const ownerPrefix = `${ownerKey}:`;
    return () => {
      [...settledKeys].forEach((key) => {
        if (key.startsWith(ownerPrefix)) settledKeys.delete(key);
      });
      [...retriedKeys].forEach((key) => {
        if (key.startsWith(ownerPrefix)) retriedKeys.delete(key);
      });
      [...retryTimers].forEach(([key, timer]) => {
        if (!key.startsWith(ownerPrefix)) return;
        window.clearTimeout(timer);
        retryTimers.delete(key);
      });
      if (queuedPresentationRef.current?.ownerKey === ownerKey) {
        queuedPresentationRef.current = null;
      }
      const current = activeRef.current;
      if (current?.ownerKey !== ownerKey) return;
      activeRef.current = null;
      if (!current.committed) {
        void releaseWorkdayAnnouncementDisplay(
          current.userId,
          current.reservation,
        );
      }
      window.setTimeout(() => {
        setActive((value) =>
          value?.ownerKey === ownerKey ? null : value,
        );
      }, 0);
    };
  }, [ownerKey]);

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
      if (document.visibilityState !== "visible") return;

      void claimWorkdayAnnouncementSound(userId, announcement.id).then(
        (claimed) => {
          const currentOwner = currentOwnerRef.current;
          if (
            mountedRef.current &&
            document.visibilityState === "visible" &&
            currentOwner.ownerKey === ownerKey &&
            claimed &&
            getScheduleSoundEnabled()
          ) {
            playScheduleTone(event.type);
          }
        },
      );

      // The first-entry flow owns the morning dialog. The 09:00 event keeps
      // only the schedule sound so the member never receives two prompts.
      if (announcement.kind === "WORKDAY_START") return;
      requestPresentation(presentLiveWorkdayAnnouncement(announcement));
    };

    const catchUpOvernightAnnouncement = () => {
      if (document.visibilityState !== "visible") return;
      const presentation = resolveFreshEntryAnnouncement(new Date());
      if (presentation.intentKind === "CONTINUE_OVERNIGHT") {
        requestPresentation(presentation);
      }
    };

    socket.on("bell", onBell);
    socket.on("connect", catchUpOvernightAnnouncement);
    if (socket.connected) catchUpOvernightAnnouncement();
    return () => {
      socket.off("bell", onBell);
      socket.off("connect", catchUpOvernightAnnouncement);
    };
  }, [
    isEligibleMember,
    ownerKey,
    requestPresentation,
    session,
    socket,
    userId,
  ]);

  useLayoutEffect(() => {
    if (!visibleAnnouncement || visibleAnnouncement.committed) return undefined;
    const current = visibleAnnouncement;
    if (document.visibilityState !== "visible") {
      clearActive(current.claimKey);
      void releaseWorkdayAnnouncementDisplay(
        current.userId,
        current.reservation,
      );
      return undefined;
    }
    let cancelled = false;

    void commitWorkdayAnnouncementDisplay(
      current.userId,
      current.reservation,
    ).then((committed) => {
      if (cancelled) return;
      if (!committed) {
        clearActive(current.claimKey);
        void releaseWorkdayAnnouncementDisplay(
          current.userId,
          current.reservation,
        );
        return;
      }

      settledPresentationKeysRef.current.add(current.claimKey);
      if (activeRef.current?.claimKey !== current.claimKey) return;
      const next = { ...current, committed: true };
      activeRef.current = next;
      setActive(next);
    });

    return () => {
      cancelled = true;
      if (activeRef.current?.claimKey === current.claimKey) return;
      void releaseWorkdayAnnouncementDisplay(
        current.userId,
        current.reservation,
      );
    };
  }, [clearActive, visibleAnnouncement]);

  useEffect(() => {
    if (!visibleAnnouncement) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      primaryButtonRef.current?.focus();
    });

    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [visibleAnnouncement]);

  if (!visibleAnnouncement) return null;

  const { presentation } = visibleAnnouncement;
  const { announcement } = presentation;

  const dismiss = () => {
    if (!visibleAnnouncement.committed) return;
    clearActive(visibleAnnouncement.claimKey);
  };
  const beginStudy = () => {
    if (!visibleAnnouncement.committed) return;
    const now = new Date();
    const currentPresentation = resolveFreshEntryAnnouncement(now);
    if (
      currentPresentation.announcement.id !== presentation.announcement.id
    ) {
      queuedPresentationRef.current = {
        ownerKey,
        presentation: currentPresentation,
      };
      clearActive(visibleAnnouncement.claimKey);
      return;
    }

    const intent = createWorkroomAnnouncementIntent(presentation, now);
    queuedPresentationRef.current = null;
    navigate(announcementActionTarget(location.pathname, location.search), {
      state: createWorkroomAnnouncementIntentState(intent),
    });
    clearActive(visibleAnnouncement.claimKey);
  };

  return createPortal(
    <div className="global-schedule-announcement" role="presentation">
      <section
        aria-busy={!visibleAnnouncement.committed}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="global-schedule-announcement__dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dismiss();
            return;
          }
          if (event.key === "Tab") {
            const buttons = [
              secondaryButtonRef.current,
              primaryButtonRef.current,
            ].filter((button): button is HTMLButtonElement => Boolean(button));
            if (buttons.length === 0) return;

            const currentIndex = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (currentIndex < 0) {
              event.preventDefault();
              (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus();
              return;
            }
            if (event.shiftKey && currentIndex <= 0) {
              event.preventDefault();
              buttons.at(-1)?.focus();
            } else if (!event.shiftKey && currentIndex === buttons.length - 1) {
              event.preventDefault();
              buttons[0]?.focus();
            }
          }
        }}
        role="dialog"
      >
        <span className="global-schedule-announcement__time">
          {presentation.badgeLabel}
        </span>
        <strong id={titleId}>{announcement.title}</strong>
        <div className="global-schedule-announcement__body" id={descriptionId}>
          {announcement.body.map((line, index) => (
            <p key={`${visibleAnnouncement.claimKey}:body:${index}`}>{line}</p>
          ))}
          <p className="global-schedule-announcement__note">
            {announcement.note}
          </p>
        </div>
        <div className="global-schedule-announcement__actions">
          <button
            className="is-secondary"
            disabled={!visibleAnnouncement.committed}
            onClick={dismiss}
            ref={secondaryButtonRef}
            type="button"
          >
            나중에
          </button>
          <button
            disabled={!visibleAnnouncement.committed}
            onClick={beginStudy}
            ref={primaryButtonRef}
            type="button"
          >
            {presentation.primaryLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
