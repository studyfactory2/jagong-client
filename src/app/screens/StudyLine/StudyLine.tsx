import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StudyBreakConfirmDialog from "../../components/ui/StudyBreakConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useWorkroomSession } from "../../context/WorkroomSessionContext";
import { getMyStudyStatistics } from "../../services/study-statistics.service";
import { getTimetable } from "../../services/timetable.service";
import {
  getWorkdayAnnouncement,
  getScheduleSoundEnabled,
  playScheduleTone,
  scheduleBellMessage,
  type ScheduleBellEvent,
} from "../../utils/schedule-bell";
import {
  createStudyRecordingView,
  resolveStudyRecordingWindow,
  WORKROOM_FALLBACK_TIMETABLE,
} from "../../utils/study-recording-policy";
import type { TimetableSlot } from "../../../lib/types";
import StudyLineSelfCameraCard from "./StudyLineSelfCameraCard";
import "./study-line.css";

const toSec = (time: string) => {
  const [hour, minute] = time.split(":");
  return Number(hour) * 3600 + Number(minute) * 60;
};

const formatCountdown = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const sec = safe % 60;
  return [hours, minutes, sec]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const formatTodayStudyTime = (seconds?: number) => {
  if (seconds === undefined || !Number.isFinite(seconds)) return "--:--:--";
  return formatCountdown(Math.floor(seconds));
};

const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const seoulDateKey = (date: Date) => {
  const parts = seoulDateFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

type StudyTimerAnchor = {
  dateKey: string;
  generatedAtMs: number;
  seconds: number;
};

type StudyTimerSource = {
  dateKey: string;
  error: boolean;
  hidden: boolean;
  loading: boolean;
  state: "STUDY" | "BREAK" | null;
  stateStartedAtMs: number | null;
};

const STUDY_TIMER_REQUEST_TIMEOUT_MS = 10000;

function projectStudyTimerSeconds(
  anchor: StudyTimerAnchor,
  source: StudyTimerSource,
  atMs: number,
): number {
  if (anchor.dateKey !== source.dateKey) return 0;
  if (source.hidden || source.loading || source.error || !source.state) {
    return anchor.seconds;
  }

  const transitionAtMs = source.stateStartedAtMs;
  const countedBoundaryMs =
    transitionAtMs === null
      ? anchor.generatedAtMs
      : Math.max(anchor.generatedAtMs, transitionAtMs);
  const additionalSeconds =
    source.state === "STUDY"
      ? Math.max(0, Math.floor((atMs - countedBoundaryMs) / 1000))
      : transitionAtMs !== null && transitionAtMs > anchor.generatedAtMs
        ? Math.max(
            0,
            Math.floor((transitionAtMs - anchor.generatedAtMs) / 1000),
          )
        : 0;
  return anchor.seconds + additionalSeconds;
}

function slotState(
  slot: TimetableSlot,
  current: TimetableSlot | undefined,
  nowSec: number,
) {
  if (current?.slot === slot.slot && current.startTime === slot.startTime) {
    return slot.isBreak ? "쉬는중" : "진행중";
  }
  if (toSec(slot.endTime) <= nowSec) return "완료";
  return "대기";
}

export default function StudyLine() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { socket } = useSocket();
  const {
    joined,
    joining,
    cameraPausedForBreak,
    error,
    localVideoTrack,
    studyStatus,
    studyStatusLoading,
    studyStatusError,
    studyActionPending,
    leaveSession,
    syncAttendanceSlot,
    refreshStudyStatus,
    startStudyBreak,
    resumeStudy,
  } = useWorkroomSession();
  const [slots, setSlots] = useState<TimetableSlot[]>(
    WORKROOM_FALLBACK_TIMETABLE,
  );
  const [timetableLoaded, setTimetableLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [bellMsg, setBellMsg] = useState("");
  const [todayStudySeconds, setTodayStudySeconds] = useState<number>();
  const [breakConfirmOpen, setBreakConfirmOpen] = useState(false);
  const bellTimerRef = useRef<number | null>(null);
  const studyTimerAnchorRef = useRef<StudyTimerAnchor | null>(null);
  const studyTimerNeedsRefreshRef = useRef(true);
  const studyTimerMountedRef = useRef(true);
  const studyTimerRefreshPromiseRef = useRef<Promise<boolean> | null>(null);
  const studyTimerRefreshQueuedRef = useRef(false);
  const refreshTodayStudyRef = useRef<() => Promise<boolean>>(
    async () => false,
  );
  const studyTimerSourceRef = useRef<StudyTimerSource>({
    dateKey: "",
    error: false,
    hidden: false,
    loading: true,
    state: null,
    stateStartedAtMs: null,
  });

  useEffect(() => {
    getTimetable()
      .then((items) => {
        setTimetableLoaded(true);
        setSlots(
          [...items].sort((a, b) => toSec(a.startTime) - toSec(b.startTime)),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onBell = (data: ScheduleBellEvent) => {
      if (getWorkdayAnnouncement(data)) return;
      const message = scheduleBellMessage(data);

      if (!message) return;
      if (getScheduleSoundEnabled()) playScheduleTone(data.type);
      if (bellTimerRef.current) window.clearTimeout(bellTimerRef.current);
      setBellMsg(message);
      bellTimerRef.current = window.setTimeout(() => {
        setBellMsg("");
        bellTimerRef.current = null;
      }, 8000);
    };

    socket.on("bell", onBell);
    return () => {
      socket.off("bell", onBell);
      if (bellTimerRef.current) {
        window.clearTimeout(bellTimerRef.current);
        bellTimerRef.current = null;
      }
    };
  }, [socket]);

  const recordingWindow = useMemo(
    () => resolveStudyRecordingWindow(slots, timetableLoaded, now),
    [now, slots, timetableLoaded],
  );
  const { current, seoulSeconds: nowSec } = recordingWindow;

  const nextSlot = useMemo(
    () => slots.find((slot) => toSec(slot.startTime) > nowSec),
    [slots, nowSec],
  );

  const completedSlots = slots.filter(
    (slot) => toSec(slot.endTime) <= nowSec,
  ).length;
  const progress = Math.min(
    100,
    Math.round((completedSlots / Math.max(1, slots.length)) * 100),
  );
  const countdownTarget = current
    ? toSec(current.endTime) - nowSec
    : nextSlot
      ? toSec(nextSlot.startTime) - nowSec
      : null;
  const activeAttendanceSlot =
    current && !current.isBreak && current.slot !== 0
      ? current.slot
      : undefined;

  useEffect(() => {
    if (!joined) return;
    syncAttendanceSlot(activeAttendanceSlot);
  }, [activeAttendanceSlot, joined, syncAttendanceSlot]);

  const currentStudyState = createStudyRecordingView({
    cameraPausedForBreak,
    loading: studyStatusLoading,
    status: studyStatus,
    window: recordingWindow,
  });
  const isStudyStatusPending = !(
    studyStatus?.active &&
    studyStatus.state &&
    studyStatus.source
  );
  const studyActionDisabled =
    studyStatusLoading ||
    Boolean(studyStatusError) ||
    studyActionPending !== null;

  const compactStudyTone =
    studyStatusLoading ||
    Boolean(studyStatusError) ||
    !studyStatus?.active ||
    studyStatus.source === "SYSTEM"
      ? "syncing"
      : cameraPausedForBreak || studyStatus.state === "BREAK"
        ? "break"
        : studyStatus.state === "STUDY"
          ? "study"
          : "syncing";
  const compactStudyLabel =
    compactStudyTone === "study"
      ? "공부중"
      : compactStudyTone === "break"
        ? "휴식중"
        : "확인중";
  const compactStudyDetail = studyStatusLoading
    ? "최신 공부 상태를 확인하고 있습니다."
    : studyStatusError
      ? "공부 상태를 다시 확인해 주세요."
      : currentStudyState.detail;
  const todayDateKey = seoulDateKey(now);

  useEffect(() => {
    const previousSource = studyTimerSourceRef.current;
    const state =
      !joined || !studyStatus?.active || studyStatus.source === "SYSTEM"
        ? null
        : cameraPausedForBreak
          ? "BREAK"
          : studyStatus.state === "STUDY" || studyStatus.state === "BREAK"
            ? studyStatus.state
            : null;
    const stateStartedAt = studyStatus?.stateStartedAt
      ? new Date(studyStatus.stateStartedAt).getTime()
      : Number.NaN;
    const nextStateStartedAtMs = Number.isFinite(stateStartedAt)
      ? stateStartedAt
      : null;
    const nextSource: StudyTimerSource = {
      dateKey: todayDateKey,
      error: Boolean(studyStatusError),
      hidden: document.visibilityState !== "visible",
      loading: studyStatusLoading,
      state,
      stateStartedAtMs: nextStateStartedAtMs,
    };
    if (
      previousSource.dateKey !== todayDateKey ||
      previousSource.state !== state ||
      previousSource.stateStartedAtMs !== nextStateStartedAtMs
    ) {
      studyTimerNeedsRefreshRef.current = true;
      if (joined && document.visibilityState === "visible") {
        window.setTimeout(() => void refreshTodayStudyRef.current(), 0);
      }
    }
    studyTimerSourceRef.current = nextSource;
  }, [
    cameraPausedForBreak,
    joined,
    studyStatus,
    studyStatusError,
    studyStatusLoading,
    todayDateKey,
  ]);

  useEffect(() => {
    studyTimerMountedRef.current = true;
    return () => {
      studyTimerMountedRef.current = false;
    };
  }, []);

  const refreshTodayStudy = useCallback((): Promise<boolean> => {
    if (studyTimerRefreshPromiseRef.current) {
      studyTimerRefreshQueuedRef.current = true;
      return studyTimerRefreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        STUDY_TIMER_REQUEST_TIMEOUT_MS,
      );
      try {
        const statistics = await getMyStudyStatistics({
          signal: controller.signal,
        });
        if (!studyTimerMountedRef.current) return false;

        const generatedAtMs = new Date(statistics.generatedAt).getTime();
        if (!Number.isFinite(generatedAtMs)) return false;
        const previous = studyTimerAnchorRef.current;
        if (previous && generatedAtMs < previous.generatedAtMs) return true;

        const startsAt = new Date(statistics.today.startsAt);
        const nextAnchor = {
          dateKey: Number.isNaN(startsAt.getTime())
            ? seoulDateKey(new Date(generatedAtMs))
            : seoulDateKey(startsAt),
          generatedAtMs,
          seconds: Math.max(0, Math.floor(statistics.today.studySeconds)),
        };
        studyTimerAnchorRef.current = nextAnchor;
        const currentSource = studyTimerSourceRef.current;
        const coversCurrentTransition =
          currentSource.stateStartedAtMs === null ||
          generatedAtMs >= currentSource.stateStartedAtMs;
        if (
          document.visibilityState === "visible" &&
          coversCurrentTransition
        ) {
          studyTimerNeedsRefreshRef.current = false;
        }
        if (coversCurrentTransition) {
          setTodayStudySeconds(
            projectStudyTimerSeconds(nextAnchor, currentSource, Date.now()),
          );
        }
        return true;
      } catch {
        return false;
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();
    studyTimerRefreshPromiseRef.current = refreshPromise;
    void refreshPromise.finally(() => {
      if (studyTimerRefreshPromiseRef.current === refreshPromise) {
        studyTimerRefreshPromiseRef.current = null;
        if (
          studyTimerRefreshQueuedRef.current &&
          studyTimerMountedRef.current
        ) {
          studyTimerRefreshQueuedRef.current = false;
          window.setTimeout(() => void refreshTodayStudyRef.current(), 0);
        }
      }
    });
    return refreshPromise;
  }, []);

  useEffect(() => {
    refreshTodayStudyRef.current = refreshTodayStudy;
  }, [refreshTodayStudy]);

  useEffect(() => {
    if (!joined) return undefined;

    const initialRefreshTimer = window.setTimeout(
      () => void refreshTodayStudy(),
      0,
    );
    const refreshTimer = window.setInterval(
      () => void refreshTodayStudy(),
      15000,
    );
    const refreshAfterInactivity = () => {
      if (document.visibilityState !== "visible") {
        studyTimerNeedsRefreshRef.current = true;
        studyTimerSourceRef.current.hidden = true;
        return;
      }
      studyTimerSourceRef.current.hidden = false;
      studyTimerNeedsRefreshRef.current = true;
      void refreshStudyStatus().finally(() => void refreshTodayStudy());
    };

    document.addEventListener("visibilitychange", refreshAfterInactivity);
    window.addEventListener("focus", refreshAfterInactivity);
    return () => {
      window.clearTimeout(initialRefreshTimer);
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshAfterInactivity);
      window.removeEventListener("focus", refreshAfterInactivity);
    };
  }, [joined, refreshStudyStatus, refreshTodayStudy]);

  useEffect(() => {
    const updateTimer = () => {
      const tickAtMs = Date.now();
      const source = studyTimerSourceRef.current;
      const anchor = studyTimerAnchorRef.current;
      if (!anchor) return;

      if (anchor.dateKey !== source.dateKey) {
        setTodayStudySeconds(0);
        return;
      }
      if (
        source.hidden ||
        source.loading ||
        source.error ||
        studyTimerNeedsRefreshRef.current ||
        !source.state
      ) {
        return;
      }

      const nextSeconds = projectStudyTimerSeconds(anchor, source, tickAtMs);
      setTodayStudySeconds((previous) =>
        previous === nextSeconds ? previous : nextSeconds,
      );
    };

    const initialTimer = window.setTimeout(updateTimer, 0);
    const intervalTimer = window.setInterval(updateTimer, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);

  const todayStudyTime = formatTodayStudyTime(todayStudySeconds);

  const handleStudyAction = async () => {
    if (currentStudyState.action === "BREAK") {
      setBreakConfirmOpen(true);
    } else if (currentStudyState.action === "RESUME") {
      if (await resumeStudy()) {
        studyTimerNeedsRefreshRef.current = true;
        void refreshTodayStudy();
      }
    }
  };

  const confirmStudyBreak = async () => {
    if (currentStudyState.action !== "BREAK" || studyActionDisabled) {
      setBreakConfirmOpen(false);
      return;
    }

    if (await startStudyBreak()) {
      studyTimerNeedsRefreshRef.current = true;
      void refreshTodayStudy();
    }
    setBreakConfirmOpen(false);
  };

  const goWaitingRoom = async () => {
    if (
      !window.confirm(
        "작업장을 나가면 교시 중에는 다시 입장하지 못할 수 있습니다. 대기장으로 이동할까요?",
      )
    ) {
      return;
    }
    await leaveSession();
    navigate("/waiting-room");
  };

  return (
    <div className="sl">
      <header className="sl-head">
        <button
          className="sl-back"
          disabled={joining}
          onClick={() => void goWaitingRoom()}
          type="button"
        >
          <ArrowBackIcon /> 대기장
        </button>
        <h1>개인작업실</h1>
        <button className="sl-pill" onClick={() => navigate("/study-room")}>
          <GroupsOutlinedIcon />
          단체작업장 입장
        </button>
      </header>

      <main className="sl-body">
        <section
          aria-busy={studyStatusLoading || studyActionPending !== null}
          className={`sl-camera-session is-${compactStudyTone}`}
        >
          <div
            aria-label={`${compactStudyLabel}. ${compactStudyDetail}`}
            aria-live="polite"
            className="sl-study-state"
            role="status"
          >
            <i aria-hidden="true" />
            <strong>{compactStudyLabel}</strong>
          </div>
          <div
            aria-label={`오늘 누적 공부시간 ${todayStudyTime}`}
            className="sl-study-timer"
            role="timer"
          >
            <small>오늘 공부시간</small>
            <strong aria-hidden="true">{todayStudyTime}</strong>
          </div>
          <div className="sl-study-action-slot">
            {joined && currentStudyState.action ? (
              <button
                className={`sl-study-action is-${currentStudyState.action.toLowerCase()}`}
                disabled={studyActionDisabled}
                onClick={() => void handleStudyAction()}
                type="button"
              >
                {currentStudyState.action === "BREAK" ? (
                  <PauseCircleOutlineRoundedIcon />
                ) : (
                  <PlayArrowRoundedIcon />
                )}
                {studyActionPending
                  ? "변경 중…"
                  : studyStatusLoading
                    ? "확인 중…"
                    : currentStudyState.actionLabel}
              </button>
            ) : joined && isStudyStatusPending && !studyStatusError ? (
              <button
                className="sl-study-action is-refresh"
                disabled={studyStatusLoading || studyActionPending !== null}
                onClick={() => void refreshStudyStatus()}
                type="button"
              >
                {studyStatusLoading ? "확인 중…" : "다시 확인"}
              </button>
            ) : null}
          </div>
        </section>

        {joined && studyStatusError && (
          <div
            aria-live="assertive"
            className="sl-study-error"
            role={studyStatusLoading ? "status" : "alert"}
          >
            <span>
              {studyStatusLoading
                ? "최신 공부 상태를 다시 확인하고 있습니다."
                : studyStatusError}
            </span>
            <button
              disabled={studyStatusLoading || studyActionPending !== null}
              onClick={() => void refreshStudyStatus()}
              type="button"
            >
              {studyStatusLoading ? "확인 중…" : "다시 확인"}
            </button>
          </div>
        )}

        {joined && error && (
          <div className="sl-camera-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        {joined && (
          <StudyLineSelfCameraCard
            cameraPausedForBreak={cameraPausedForBreak}
            memberName={session?.user.name ?? "나"}
            track={localVideoTrack}
          />
        )}

        <section className="sl-bottom">
          <div className="sl-metric sl-progress-card">
            <span>오늘 나의 진행률</span>
            <strong>{progress}%</strong>
            <em>
              {completedSlots}/{slots.length} 완료 ·{" "}
              {Math.max(0, slots.length - completedSlots)}개 남음
            </em>
            <div className="sl-progress-track">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="sl-metric sl-countdown-card">
            <span>다음 종까지</span>
            <strong>
              {countdownTarget == null
                ? "--:--:--"
                : formatCountdown(countdownTarget)}
            </strong>
          </div>
        </section>

        <section className="sl-card sl-line">
          <div className="sl-line-grid">
            {slots.map((slot) => {
              const state = slotState(slot, current, nowSec);
              return (
                <div
                  className={`sl-row ${
                    state === "진행중" || state === "쉬는중" ? "is-now" : ""
                  }${slot.isBreak ? " is-break" : ""}`}
                  key={`${slot.slot}-${slot.startTime}`}
                >
                  {slot.isBreak ? (
                    <HourglassEmptyOutlinedIcon />
                  ) : (
                    <NotificationsOutlinedIcon />
                  )}
                  <strong>{slot.label}</strong>
                  <span>
                    {slot.startTime} - {slot.endTime}
                  </span>
                  <em>{state}</em>
                </div>
              );
            })}
          </div>
        </section>

        <section className="sl-notice">
          <NotificationsOutlinedIcon />
          <div>
            <span>알림</span>
            <p>
              {bellMsg ||
                `관리자 공지: ${
                  current?.label ?? nextSlot?.label ?? "오늘 일정"
                } 중에는 화면 켜 상태를 유지해 주세요.`}
            </p>
          </div>
        </section>
      </main>

      <StudyBreakConfirmDialog
        onCancel={() => setBreakConfirmOpen(false)}
        onConfirm={confirmStudyBreak}
        open={breakConfirmOpen}
        pending={studyActionPending === "BREAK"}
      />

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
