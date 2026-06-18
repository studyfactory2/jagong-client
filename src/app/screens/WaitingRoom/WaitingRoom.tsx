import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import MicNoneIcon from "@mui/icons-material/MicNone";
import MicOffIcon from "@mui/icons-material/MicOff";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { getOnlineCount } from "../../services/status.service";
import { getTimetable } from "../../services/timetable.service";
import type { TimetableSlot } from "../../../lib/types";
import "./waiting-room.css";

type PreviewWorker = {
  nick: string;
  mic: boolean;
  gradient: string;
};

const PREVIEW: PreviewWorker[] = [
  {
    nick: "오늘도합격",
    mic: true,
    gradient: "linear-gradient(135deg,#3f5b6e,#273d4d)",
  },
  {
    nick: "정리왕",
    mic: true,
    gradient: "linear-gradient(135deg,#6a8f6f,#4f7a5a)",
  },
  {
    nick: "해피스터디",
    mic: false,
    gradient: "linear-gradient(135deg,#7d7aa8,#5d5a88)",
  },
  {
    nick: "공부는내일",
    mic: false,
    gradient: "linear-gradient(135deg,#b08a4f,#8a6a2f)",
  },
  {
    nick: "꾸준히가자",
    mic: false,
    gradient: "linear-gradient(135deg,#5f8aa8,#3f6a88)",
  },
  {
    nick: "합격기원",
    mic: true,
    gradient: "linear-gradient(135deg,#a85f7a,#88405a)",
  },
  {
    nick: "포기하지마",
    mic: true,
    gradient: "linear-gradient(135deg,#6a8f6f,#4f7a5a)",
  },
  {
    nick: "노력은배신X",
    mic: false,
    gradient: "linear-gradient(135deg,#7d6a55,#5a4a38)",
  },
];

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

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const sec = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const isClockInSlot = (slot?: TimetableSlot | null) =>
  Boolean(slot && (slot.slot === 0 || slot.label.includes("출근")));

function formatDate(date: Date) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}. ${String(date.getDate()).padStart(2, "0")} (${days[date.getDay()]})`;
}

export default function WaitingRoom() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const { online, connected, socket } = useSocket();

  const [slots, setSlots] = useState<TimetableSlot[]>(FALLBACK_TIMETABLE);
  const [now, setNow] = useState(() => new Date());
  const [onlineFallback, setOnlineFallback] = useState<number | null>(null);
  const [bellMsg, setBellMsg] = useState("");

  useEffect(() => {
    if (session?.user.role === "ADMIN" || session?.user.role === "STAFF") {
      navigate("/admin", { replace: true });
    }
  }, [navigate, session?.user.role]);

  useEffect(() => {
    getTimetable()
      .then((items) => {
        if (!items.length) return;
        setSlots(
          [...items].sort((a, b) => toSec(a.startTime) - toSec(b.startTime)),
        );
      })
      .catch(() => {});

    getOnlineCount()
      .then((data) => setOnlineFallback(data.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onBell = (data: { type: string; label?: string }) => {
      const message =
        data.type === "countdown"
          ? `곧 ${data.label ?? "다음 교시"} 시작돼요`
          : data.type === "periodStart"
            ? `${data.label ?? "교시"} 시작! 카메라와 마이크 상태를 확인해 주세요.`
            : data.type === "breakStart"
              ? "쉬는시간입니다. 다음 교시 전까지 준비해 주세요."
              : "";

      if (!message) return;
      setBellMsg(message);
      window.setTimeout(() => setBellMsg(""), 8000);
    };

    socket.on("bell", onBell);
    return () => {
      socket.off("bell", onBell);
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
    () => slots.find((slot) => toSec(slot.startTime) > nowSec) ?? null,
    [slots, nowSec],
  );

  const completedWorkSlots = slots.filter(
    (slot) => !slot.isBreak && toSec(slot.endTime) <= nowSec,
  ).length;
  const totalWorkSlots = slots.filter((slot) => !slot.isBreak).length || 1;
  const elapsedWorkSeconds = slots.reduce((sum, slot) => {
    if (slot.isBreak) return sum;
    const start = toSec(slot.startTime);
    const end = toSec(slot.endTime);
    if (nowSec <= start) return sum;
    if (nowSec >= end) return sum + end - start;
    return sum + nowSec - start;
  }, 0);
  const totalWorkSeconds =
    slots.reduce((sum, slot) => {
      if (slot.isBreak) return sum;
      return sum + Math.max(0, toSec(slot.endTime) - toSec(slot.startTime));
    }, 0) || 1;
  const progress = Math.min(
    100,
    Math.round((elapsedWorkSeconds / totalWorkSeconds) * 100),
  );
  const connectedCount = online ?? onlineFallback ?? 13;
  const countdownTarget = current
    ? toSec(current.endTime) - nowSec
    : nextSlot
      ? toSec(nextSlot.startTime) - nowSec
      : null;
  const canEnterRoom = !current || current.isBreak || isClockInSlot(current);
  const enterStatusText = canEnterRoom ? "입장 가능" : "교시중 입장 불가";
  const canUseAdmin =
    session?.user.role === "ADMIN" || session?.user.role === "STAFF";

  return (
    <div className="wr">
      <header className="wr-head">
        <button
          className="wr-back"
          onClick={() => navigate("/", { replace: true })}
        >
          <ArrowBackIcon /> 뒤로가기
        </button>

        <div className="wr-title-wrap">
          <h1 className="wr-title">자격증공장 작업 대기장</h1>
          <p className="wr-sub">전문자격 온라인 성인관리형독서실</p>
        </div>

        <div className="wr-head-actions">
          <button
            className="wr-icon-btn"
            aria-label="알림"
            onClick={() => navigate("/inquiry")}
          >
            <NotificationsNoneOutlinedIcon />
          </button>
          <button
            className="wr-icon-btn"
            aria-label="로그아웃"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogoutOutlinedIcon />
          </button>
        </div>
      </header>

      <main className="wr-body">
        <section className="wr-panel wr-workers">
          <div className="wr-panel-head">
            <div className="wr-panel-title">
              <VideocamOutlinedIcon />
              <span>전국사원 근무현황</span>
            </div>

            <div className="wr-badges">
              <span className="wr-badge is-on">
                <i />
                {connectedCount}명 근무중
              </span>
              <span className="wr-badge is-wait">
                <i />
                15명 출근 대기중
              </span>
            </div>
          </div>

          <div className="wr-worker-grid">
            {PREVIEW.map((worker, index) => (
              <div
                className="wr-worker"
                key={worker.nick}
                style={{ background: worker.gradient }}
              >
                <img
                  src={`/preview/${index + 1}.jpg`}
                  alt=""
                  className="wr-worker-img"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
                <span className="wr-worker-name">{worker.nick}</span>
                <span className={`wr-worker-mic${worker.mic ? "" : " is-off"}`}>
                  {worker.mic ? <MicNoneIcon /> : <MicOffIcon />}
                </span>
              </div>
            ))}
          </div>

          <p className="wr-preview-note">
            *위 미리보기 화면은, 실제 이용자의 랜덤화면으로, 수시로 권한 됩니다.
          </p>
        </section>

        <section className="wr-panel wr-time">
          <div className="wr-panel-head">
            <div className="wr-panel-title">
              <CalendarMonthOutlinedIcon />
              <span>재택근무시간표</span>
            </div>
            <span className="wr-date">{formatDate(now)}</span>
          </div>

          <div className="wr-time-grid">
            {slots.map((slot) => {
              const isCurrent =
                current?.slot === slot.slot &&
                current.startTime === slot.startTime;

              return (
                <div
                  className={`wr-time-row${isCurrent ? " is-current" : ""}${
                    slot.isBreak ? " is-break" : ""
                  }`}
                  key={`${slot.slot}-${slot.startTime}`}
                >
                  {slot.isBreak ? (
                    <HourglassEmptyOutlinedIcon />
                  ) : (
                    <NotificationsOutlinedIcon />
                  )}
                  <span className="wr-time-label">{slot.label}</span>
                  <span className="wr-time-range">
                    {slot.startTime} - {slot.endTime}
                  </span>
                  <span className="wr-time-duration">
                    (
                    {slot.duration ??
                      Math.round(
                        (toSec(slot.endTime) - toSec(slot.startTime)) / 60,
                      )}
                    분)
                  </span>
                </div>
              );
            })}
          </div>

          <p className="wr-caution">
            *출근시간과 쉬는시간에는 입장 가능하며, 교시중에는 관리자 허용 후
            입장합니다.
          </p>
        </section>

        <section className="wr-progress">
          <div className="wr-progress-card">
            <span>오늘 작업장 진행률</span>
            <strong>{progress}%</strong>
            <em>
              ({completedWorkSlots}/{totalWorkSlots})
            </em>
            <div className="wr-progress-bar">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="wr-countdown">
            <NotificationsOutlinedIcon />
            <span>다음종까지</span>
            <strong>
              {countdownTarget == null
                ? "--:--"
                : formatDuration(countdownTarget)}
            </strong>
          </div>
        </section>

        <button
          className="wr-notice"
          onClick={() => navigate("/inquiry")}
          type="button"
        >
          <span>공지</span>
          {bellMsg ||
            `관리자 공지: ${current?.label ?? "현재 교시"} 시작 전 카메라와 마이크 상태를 확인해 주세요.`}
        </button>

        <section className="wr-entry">
          <button
            className="wr-entry-btn is-private"
            disabled={!canEnterRoom}
            onClick={() => navigate("/study-line")}
          >
            <DoorFrontOutlinedIcon />
            <span>
              <strong>개인 작업실 입장</strong>
              <em>{canEnterRoom ? "나만의 집중 작업실" : enterStatusText}</em>
            </span>
          </button>

          <button
            className="wr-entry-btn is-group"
            disabled={!canEnterRoom}
            onClick={() => navigate("/study-room")}
          >
            <GroupsOutlinedIcon />
            <span>
              <strong>단체 작업장 입장</strong>
              <em>
                {canEnterRoom ? "전국 사원과 함께 입장" : enterStatusText}
              </em>
            </span>
          </button>
        </section>

        <section className="wr-shortcuts">
          <button onClick={() => navigate("/weekly-plan")}>
            <EventNoteOutlinedIcon />
            주간작업계획
          </button>
          <button onClick={() => navigate("/leaves")}>
            <LockOutlinedIcon />
            휴가내역 및 신청
          </button>
          <button onClick={() => navigate("/inquiry")}>
            <ArticleOutlinedIcon />
            게시판
          </button>
          <button onClick={() => navigate("/payments")}>
            <AccessTimeOutlinedIcon />
            연장하기
          </button>
          <button onClick={() => navigate("/my-page")}>
            <AccountCircleOutlinedIcon />내 정보
          </button>
          {canUseAdmin && (
            <button onClick={() => navigate("/admin")}>
              <SettingsOutlinedIcon />
              관리자
            </button>
          )}
        </section>

        <p className="wr-user">
          {connected ? "접속됨" : "연결 중"} · {session?.user.name ?? "사원"} 님
        </p>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
