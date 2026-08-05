import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import WorkroomCameraSetup from "../../components/WorkroomCameraSetup";
import StudyBreakConfirmDialog from "../../components/ui/StudyBreakConfirmDialog";
import { useSocket } from "../../context/SocketContext";
import { useWorkroomSession } from "../../context/WorkroomSessionContext";
import { getTimetable } from "../../services/timetable.service";
import {
  getScheduleSoundEnabled,
  playScheduleTone,
  scheduleBellMessage,
  setScheduleSoundEnabled,
  type ScheduleBellEvent,
} from "../../utils/schedule-bell";
import type { StudyTimeStatus, TimetableSlot } from "../../../lib/types";
import "./study-line.css";

const FALLBACK_TIMETABLE: TimetableSlot[] = [
  {
    slot: 0,
    label: "출근",
    startTime: "08:00",
    endTime: "09:00",
    duration: 60,
    isBreak: false,
  },
  {
    slot: 1,
    label: "1교시",
    startTime: "09:00",
    endTime: "10:30",
    duration: 90,
    isBreak: false,
  },
  {
    slot: 2,
    label: "2교시",
    startTime: "10:45",
    endTime: "12:05",
    duration: 80,
    isBreak: false,
  },
  {
    slot: 3,
    label: "점심",
    startTime: "12:05",
    endTime: "13:20",
    duration: 75,
    isBreak: true,
  },
  {
    slot: 4,
    label: "3교시",
    startTime: "13:20",
    endTime: "14:30",
    duration: 70,
    isBreak: false,
  },
  {
    slot: 5,
    label: "4교시",
    startTime: "14:45",
    endTime: "16:15",
    duration: 90,
    isBreak: false,
  },
  {
    slot: 6,
    label: "5교시",
    startTime: "16:30",
    endTime: "17:50",
    duration: 80,
    isBreak: false,
  },
  {
    slot: 7,
    label: "저녁",
    startTime: "17:50",
    endTime: "19:05",
    duration: 75,
    isBreak: true,
  },
  {
    slot: 8,
    label: "6교시",
    startTime: "19:05",
    endTime: "20:25",
    duration: 80,
    isBreak: false,
  },
  {
    slot: 9,
    label: "7교시",
    startTime: "20:40",
    endTime: "22:00",
    duration: 80,
    isBreak: false,
  },
];

const toSec = (time: string) => {
  const [hour, minute] = time.split(":");
  return Number(hour) * 3600 + Number(minute) * 60;
};

const seoulClockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function seoulSecondsSinceMidnight(date: Date): number {
  const parts = seoulClockFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return value("hour") * 3600 + value("minute") * 60 + value("second");
}

function stateStartedWithinSlot(
  value: string | null | undefined,
  slot: TimetableSlot | undefined,
  referenceAt: Date,
): boolean {
  if (!value || !slot) return false;
  const startedAt = new Date(value);
  if (Number.isNaN(startedAt.getTime())) return false;

  const startedAtSeconds = seoulSecondsSinceMidnight(startedAt);
  return (
    seoulDateFormatter.format(startedAt) ===
      seoulDateFormatter.format(referenceAt) &&
    toSec(slot.startTime) <= startedAtSeconds &&
    startedAtSeconds < toSec(slot.endTime)
  );
}

const formatCountdown = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const sec = safe % 60;
  return [hours, minutes, sec]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

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

type StudyStateView = {
  action: "BREAK" | "RESUME" | null;
  detail: string;
  label: string;
  tone: "study" | "break" | "schedule" | "system" | "syncing";
};

const studyStateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
});

function studyStateStartedAt(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${studyStateTimeFormatter.format(date)}부터`;
}

function studyStateView(
  status: StudyTimeStatus | null,
  loading: boolean,
  canResumeInStudySlot: boolean,
  isTimetableBreak: boolean,
  memberStudyStartedInBreak: boolean,
): StudyStateView {
  if (!status?.active || !status.state || !status.source) {
    return {
      action: null,
      detail: loading
        ? "서버 기록을 연결하고 있습니다."
        : status?.active === false
          ? "카메라 등록이 완료되면 공부시간 기록이 자동으로 시작됩니다."
          : "서버의 현재 공부 기록 연결을 기다리고 있습니다.",
      label: loading
        ? "공부 상태 연결 중"
        : status?.active === false
          ? "카메라 등록 대기"
          : "공부 기록 연결 대기",
      tone: "syncing",
    };
  }

  const startedAt = studyStateStartedAt(status.stateStartedAt);

  if (status.source === "SYSTEM") {
    return {
      action: null,
      detail: "카메라 연결을 복구해 주세요.",
      label: "카메라 확인 필요",
      tone: "system",
    };
  }

  if (isTimetableBreak) {
    if (
      status.state === "STUDY" &&
      status.source === "MEMBER" &&
      memberStudyStartedInBreak
    ) {
      return {
        action: "BREAK",
        detail: startedAt
          ? `${startedAt} 실제 공부시간에 포함되고 있습니다.`
          : "실제 공부시간에 포함되고 있습니다.",
        label: "휴식시간 공부 중",
        tone: "study",
      };
    }

    const canContinueDuringBreak =
      (status.state === "BREAK" &&
        (status.source === "SCHEDULE" || status.source === "MEMBER")) ||
      (status.state === "STUDY" &&
        (status.source === "SCHEDULE" || status.source === "ROOM"));
    if (canContinueDuringBreak) {
      return {
        action: "RESUME",
        detail: "계속 공부하기를 누르면 지금부터 실제 공부시간에 포함됩니다.",
        label: status.source === "MEMBER" ? "휴식 중" : "정규 휴식",
        tone: status.source === "MEMBER" ? "break" : "schedule",
      };
    }

    return status.source === "ADMIN"
      ? {
          action: null,
          detail: "관리자가 설정한 공부 상태입니다.",
          label: "관리자 상태 확인 필요",
          tone: "system",
        }
      : {
          action: null,
          detail: "서버의 정규 휴식 전환을 확인하고 있습니다.",
          label: "정규 휴식 전환 중",
          tone: "syncing",
        };
  }

  if (status.state === "STUDY") {
    return {
      action: "BREAK",
      detail: startedAt || "실제 공부시간에 포함됩니다.",
      label: "공부 중",
      tone: "study",
    };
  }

  if (status.source === "MEMBER") {
    return {
      action: canResumeInStudySlot ? "RESUME" : null,
      detail: canResumeInStudySlot
        ? startedAt || "공부시간 집계를 쉬고 있습니다."
        : "공부 교시가 시작되면 재개할 수 있습니다.",
      label: "휴식 중",
      tone: "break",
    };
  }

  if (status.source === "SCHEDULE") {
    return {
      action: null,
      detail: "시간표에 따른 쉬는시간입니다.",
      label: "정규 휴식",
      tone: "schedule",
    };
  }

  return {
    action: null,
    detail: "관리자 상태를 확인해 주세요.",
    label: "공부시간 일시정지",
    tone: "system",
  };
}

export default function StudyLine() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const {
    joined,
    joining,
    cameraReady,
    error,
    studyStatus,
    studyStatusLoading,
    studyStatusError,
    studyActionPending,
    startSession,
    syncAttendanceSlot,
    refreshStudyStatus,
    startStudyBreak,
    resumeStudy,
  } = useWorkroomSession();
  const [slots, setSlots] = useState<TimetableSlot[]>(FALLBACK_TIMETABLE);
  const [now, setNow] = useState(() => new Date());
  const [bellMsg, setBellMsg] = useState("");
  const [scheduleSoundEnabled, setScheduleSoundPreference] = useState(
    getScheduleSoundEnabled,
  );
  const [breakConfirmOpen, setBreakConfirmOpen] = useState(false);
  const bellTimerRef = useRef<number | null>(null);
  const scheduleSoundEnabledRef = useRef(scheduleSoundEnabled);

  useEffect(() => {
    getTimetable()
      .then((items) => {
        if (!items.length) return;
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
    scheduleSoundEnabledRef.current = scheduleSoundEnabled;
  }, [scheduleSoundEnabled]);

  useEffect(() => {
    if (!socket) return;

    const onBell = (data: ScheduleBellEvent) => {
      const message = scheduleBellMessage(data);

      if (!message) return;
      if (scheduleSoundEnabledRef.current) playScheduleTone(data.type);
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

  const nowSec = seoulSecondsSinceMidnight(now);

  const current = useMemo(() => {
    const matches = slots.filter(
      (slot) =>
        toSec(slot.startTime) <= nowSec && nowSec < toSec(slot.endTime),
    );
    return matches.length === 1 ? matches[0] : undefined;
  }, [slots, nowSec]);

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
  const countdownLabel = current
    ? `${current.label} 종료 알림 예정`
    : nextSlot
      ? `${nextSlot.label} 시작 알림 예정`
      : "오늘 일정이 종료되었습니다";

  const activeAttendanceSlot =
    current && !current.isBreak && current.slot !== 0
      ? current.slot
      : undefined;

  useEffect(() => {
    if (!joined) return;
    syncAttendanceSlot(activeAttendanceSlot);
  }, [activeAttendanceSlot, joined, syncAttendanceSlot]);

  const cameraStatus = joined
    ? "연결됨"
    : joining
      ? "준비 중"
      : cameraReady
        ? "미리보기"
        : "설정 필요";
  const currentStudyState = studyStateView(
    studyStatus,
    studyStatusLoading,
    Boolean(current && !current.isBreak && current.slot !== 0),
    Boolean(current && current.isBreak && current.slot !== 0),
    Boolean(
      current?.isBreak &&
        current.slot !== 0 &&
        studyStatus?.state === "STUDY" &&
        studyStatus.source === "MEMBER" &&
        stateStartedWithinSlot(studyStatus.stateStartedAt, current, now),
    ),
  );
  const isStudyStatusPending = !(
    studyStatus?.active &&
    studyStatus.state &&
    studyStatus.source
  );
  const studyActionDisabled =
    studyStatusLoading ||
    Boolean(studyStatusError) ||
    studyActionPending !== null;

  const handleJoin = async () => {
    await startSession(activeAttendanceSlot);
  };

  const handleStudyAction = async () => {
    if (currentStudyState.action === "BREAK") {
      setBreakConfirmOpen(true);
    } else if (currentStudyState.action === "RESUME") {
      await resumeStudy();
    }
  };

  const confirmStudyBreak = async () => {
    if (
      currentStudyState.action !== "BREAK" ||
      studyActionDisabled
    ) {
      setBreakConfirmOpen(false);
      return;
    }

    await startStudyBreak();
    setBreakConfirmOpen(false);
  };

  const toggleScheduleSound = () => {
    const next = !scheduleSoundEnabled;
    setScheduleSoundPreference(next);
    void setScheduleSoundEnabled(next).then((enabled) => {
      if (next && enabled) playScheduleTone("preview");
      if (!enabled) setScheduleSoundPreference(false);
    });
  };

  return (
    <div className="sl">
      <header className="sl-head">
        <button className="sl-back" onClick={() => navigate("/waiting-room")}>
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
          className={`sl-camera-session${joined ? " is-joined" : ""}`}
        >
          <div className="sl-camera-status">
            <VideocamOutlinedIcon />
            <strong>{cameraStatus}</strong>
          </div>
          {joined && (
            <div className={`sl-study-control is-${currentStudyState.tone}`}>
              <div
                aria-atomic="true"
                aria-live="polite"
                className="sl-study-copy"
                role="status"
              >
                <i aria-hidden="true" />
                <span>
                  <strong>{currentStudyState.label}</strong>
                  <small>{currentStudyState.detail}</small>
                </span>
              </div>
              {currentStudyState.action ? (
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
                      : currentStudyState.action === "BREAK"
                        ? "휴식 시작"
                        : current?.isBreak && current.slot !== 0
                          ? "계속 공부하기"
                          : "공부 재개"}
                </button>
              ) : isStudyStatusPending && !studyStatusError ? (
                <button
                  className="sl-study-action is-refresh"
                  disabled={
                    studyStatusLoading || studyActionPending !== null
                  }
                  onClick={() => void refreshStudyStatus()}
                  type="button"
                >
                  {studyStatusLoading ? "확인 중…" : "다시 확인"}
                </button>
              ) : null}
            </div>
          )}
          <button
            className={`sl-sound-btn${scheduleSoundEnabled ? " is-on" : ""}`}
            type="button"
            onClick={toggleScheduleSound}
            aria-label={
              scheduleSoundEnabled
                ? "일정 알림 소리 끄기"
                : "일정 알림 소리 켜기"
            }
            title={
              scheduleSoundEnabled
                ? "일정 알림 소리 끄기"
                : "일정 알림 소리 켜기"
            }
          >
            {scheduleSoundEnabled ? (
              <VolumeUpRoundedIcon />
            ) : (
              <VolumeOffRoundedIcon />
            )}
          </button>
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

        {!joined && (
          <WorkroomCameraSetup
            title="개인 작업실 입장 준비"
            description="미리보기에서 카메라와 화면 효과를 확인한 뒤 개인 작업실에 입장해 주세요."
            confirmLabel="개인 작업실 입장"
            onConfirm={handleJoin}
          />
        )}

        {joined && error && (
          <div className="sl-camera-error" role="alert">
            <span>{error}</span>
          </div>
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
            <em>{countdownLabel}</em>
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
