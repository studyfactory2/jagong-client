import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import WorkroomCameraSetup from "../../components/WorkroomCameraSetup";
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
import type { TimetableSlot } from "../../../lib/types";
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

export default function StudyLine() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { joined, joining, cameraReady, error, startSession } =
    useWorkroomSession();
  const [slots, setSlots] = useState<TimetableSlot[]>(FALLBACK_TIMETABLE);
  const [now, setNow] = useState(() => new Date());
  const [bellMsg, setBellMsg] = useState("");
  const [scheduleSoundEnabled, setScheduleSoundPreference] = useState(
    getScheduleSoundEnabled,
  );
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

  const nowSec =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const current = useMemo(
    () =>
      slots.find(
        (slot) =>
          toSec(slot.startTime) <= nowSec && nowSec < toSec(slot.endTime),
      ),
    [slots, nowSec],
  );

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

  const cameraStatus = joined
    ? "연결됨"
    : joining
      ? "준비 중"
      : cameraReady
        ? "미리보기"
        : "설정 필요";

  const handleJoin = async () => {
    await startSession(activeAttendanceSlot);
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
        <section className="sl-camera-session" aria-live="polite">
          <div className="sl-camera-status">
            <VideocamOutlinedIcon />
            <strong>{cameraStatus}</strong>
          </div>
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

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
