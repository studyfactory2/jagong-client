import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
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
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import type { Room } from "livekit-client";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { getMyAttendance } from "../../services/attendance.service";
import { getCamRoomMembers, issueCamToken } from "../../services/cam.service";
import { getTimetable } from "../../services/timetable.service";
import type {
  AttendanceRecord,
  AttendanceStatusName,
  CamRoomMember,
  TimetableSlot,
} from "../../../lib/types";
import "./waiting-room.css";

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

const isWorkPeriodSlot = (slot: TimetableSlot) =>
  !slot.isBreak && !isClockInSlot(slot);

const ATTENDANCE_TEXT: Record<AttendanceStatusName, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ABSENT: "결석",
  EXCUSED: "인정",
};

const ATTENDANCE_CLASS: Record<AttendanceStatusName, string> = {
  PRESENT: "is-present",
  LATE: "is-late",
  ABSENT: "is-absent",
  EXCUSED: "is-excused",
};

function formatDate(date: Date) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}. ${String(date.getDate()).padStart(2, "0")} (${days[date.getDay()]})`;
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function workerGradient(index: number) {
  return index % 4 === 0
    ? "linear-gradient(135deg,#3f5b6e,#273d4d)"
    : index % 4 === 1
      ? "linear-gradient(135deg,#6a8f6f,#4f7a5a)"
      : index % 4 === 2
        ? "linear-gradient(135deg,#7d7aa8,#5d5a88)"
        : "linear-gradient(135deg,#b08a4f,#8a6a2f)";
}

function randomRank(value: string, seed: string) {
  let hash = 0;
  const input = `${seed}:${value}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 1000003;
  }
  return hash;
}

type RemoteVideoTrack = {
  attach: (element?: HTMLMediaElement) => HTMLMediaElement;
  detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
};

type RemoteVideo = {
  trackSid: string;
  userId: string;
  track: RemoteVideoTrack;
};

function WorkerPreviewVideo({ track }: { track: RemoteVideoTrack }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return undefined;

    track.attach(element);
    element.play().catch(() => undefined);

    return () => {
      track.detach(element);
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="wr-worker-video"
    />
  );
}

export default function WaitingRoom() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const { connected, socket } = useSocket();

  const [slots, setSlots] = useState<TimetableSlot[]>(FALLBACK_TIMETABLE);
  const [now, setNow] = useState(() => new Date());
  const [bellMsg, setBellMsg] = useState("");
  const [roomMembers, setRoomMembers] = useState<CamRoomMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [previewVideos, setPreviewVideos] = useState<RemoteVideo[]>([]);
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "connecting" | "connected" | "stub" | "error"
  >("idle");
  const bellTimerRef = useRef<number | null>(null);
  const previewRoomRef = useRef<Room | null>(null);
  const previewIdsRef = useRef<string[]>([]);

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
  }, []);

  const refreshRoomMembers = useCallback(async () => {
    try {
      const members = await getCamRoomMembers();
      setRoomMembers(members);
    } catch {
      setRoomMembers([]);
    }
  }, []);

  const refreshAttendance = useCallback(async () => {
    try {
      const records = await getMyAttendance({ date: isoDate(new Date()) });
      setAttendance(records);
    } catch {
      setAttendance([]);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refreshRoomMembers();
      void refreshAttendance();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshRoomMembers();
      void refreshAttendance();
    }, 20000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refreshAttendance, refreshRoomMembers]);

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
            ? `${data.label ?? "교시"} 시작! 카메라 상태를 확인해 주세요.`
            : data.type === "breakStart"
              ? "쉬는시간입니다. 다음 교시 전까지 준비해 주세요."
              : "";

      if (!message) return;
      if (bellTimerRef.current) window.clearTimeout(bellTimerRef.current);
      setBellMsg(message);
      bellTimerRef.current = window.setTimeout(() => {
        setBellMsg("");
        bellTimerRef.current = null;
      }, 8000);
    };

    socket.on("bell", onBell);
    socket.on("cam:join", refreshRoomMembers);
    socket.on("cam:leave", refreshRoomMembers);
    return () => {
      socket.off("bell", onBell);
      socket.off("cam:join", refreshRoomMembers);
      socket.off("cam:leave", refreshRoomMembers);
      if (bellTimerRef.current) {
        window.clearTimeout(bellTimerRef.current);
        bellTimerRef.current = null;
      }
    };
  }, [refreshRoomMembers, socket]);

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

  const workPeriodSlots = useMemo(
    () => slots.filter(isWorkPeriodSlot),
    [slots],
  );
  const completedWorkSlots = workPeriodSlots.filter(
    (slot) => toSec(slot.endTime) <= nowSec,
  ).length;
  const totalWorkSlots = workPeriodSlots.length || 1;
  const elapsedWorkSeconds = workPeriodSlots.reduce((sum, slot) => {
    const start = toSec(slot.startTime);
    const end = toSec(slot.endTime);
    if (nowSec <= start) return sum;
    if (nowSec >= end) return sum + end - start;
    return sum + nowSec - start;
  }, 0);
  const totalWorkSeconds =
    workPeriodSlots.reduce((sum, slot) => {
      return sum + Math.max(0, toSec(slot.endTime) - toSec(slot.startTime));
    }, 0) || 1;
  const progress = Math.min(
    100,
    Math.round((elapsedWorkSeconds / totalWorkSeconds) * 100),
  );
  const countdownTarget = current
    ? toSec(current.endTime) - nowSec
    : nextSlot
      ? toSec(nextSlot.startTime) - nowSec
      : null;
  const canEnterRoom = !current || current.isBreak || isClockInSlot(current);
  const enterStatusText = canEnterRoom ? "입장 가능" : "교시중 입장 불가";
  const canUseAdmin =
    session?.user.role === "ADMIN" || session?.user.role === "STAFF";
  const attendanceBySlot = useMemo(
    () => new Map(attendance.map((record) => [record.slot, record])),
    [attendance],
  );
  const workPeriodSlotNumbers = useMemo(
    () => new Set(workPeriodSlots.map((slot) => slot.slot)),
    [workPeriodSlots],
  );
  const currentAttendance = current
    ? attendanceBySlot.get(current.slot)
    : undefined;
  const currentAttendanceStatus =
    (currentAttendance?.status as AttendanceStatusName | undefined) ?? null;
  const attendanceCount = attendance.filter(
    (record) =>
      workPeriodSlotNumbers.has(record.slot) &&
      (record.status === "PRESENT" || record.status === "EXCUSED"),
  ).length;
  const workingMemberCount = roomMembers.filter(
    (member) => member.isWorking,
  ).length;
  const waitingMemberCount = Math.max(
    0,
    roomMembers.length - workingMemberCount,
  );
  const displayWorkingMemberCount =
    workingMemberCount > 0 ? workingMemberCount : 1;
  const displayWaitingMemberCount =
    workingMemberCount > 0 ? waitingMemberCount : 9;
  const previewSeed = isoDate(now);
  const previewMembers = useMemo(() => {
    const byRank = (a: CamRoomMember, b: CamRoomMember) =>
      randomRank(a.id, previewSeed) - randomRank(b.id, previewSeed);
    const working = roomMembers
      .filter((member) => member.isWorking)
      .sort(byRank);
    const waiting = roomMembers
      .filter((member) => !member.isWorking)
      .sort(byRank);
    const remainingSlots = Math.max(0, 8 - Math.min(working.length, 8));

    return [...working.slice(0, 8), ...waiting.slice(0, remainingSlots)];
  }, [previewSeed, roomMembers]);
  const livePreviewIds = useMemo(
    () =>
      previewMembers
        .filter((member) => member.isWorking)
        .map((member) => member.id),
    [previewMembers],
  );
  const effectivePreviewStatus =
    livePreviewIds.length === 0 ? "idle" : previewStatus;
  const previewVideoByUser = useMemo(() => {
    const map = new Map<string, RemoteVideo>();
    previewVideos.forEach((video) => {
      map.set(video.userId, video);
    });
    return map;
  }, [previewVideos]);
  const syncPreviewSubscriptions = useCallback(
    (room = previewRoomRef.current) => {
      if (!room) return;
      const visible = new Set(previewIdsRef.current);

      room.remoteParticipants.forEach((participant) => {
        const shouldSubscribe = visible.has(participant.identity);

        participant.trackPublications.forEach((publication) => {
          const isVideo =
            String(publication.kind) === "video" ||
            String(publication.source) === "camera";
          if (!isVideo) return;
          publication.setSubscribed(shouldSubscribe);
        });
      });
    },
    [],
  );

  useEffect(() => {
    previewIdsRef.current = livePreviewIds;
    syncPreviewSubscriptions();
  }, [livePreviewIds, syncPreviewSubscriptions]);

  useEffect(() => {
    if (livePreviewIds.length === 0) {
      return undefined;
    }

    let mounted = true;
    let localRoom: Room | null = null;

    async function connectPreviewViewer() {
      try {
        setPreviewStatus("connecting");
        const token = await issueCamToken({ preview: true });

        if (!mounted) return;

        if (!token.url || token.token.startsWith("stub.")) {
          setPreviewStatus("stub");
          return;
        }

        const { Room, RoomEvent } = await import("livekit-client");
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        localRoom = room;
        previewRoomRef.current = room;

        room.on(
          RoomEvent.TrackSubscribed,
          (track, publication, participant) => {
            if (String(track.kind) !== "video") return;
            setPreviewVideos((current) => {
              const next = current.filter(
                (video) => video.trackSid !== publication.trackSid,
              );
              return [
                ...next,
                {
                  trackSid: publication.trackSid,
                  userId: participant.identity,
                  track: track as RemoteVideoTrack,
                },
              ];
            });
          },
        );

        room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
          setPreviewVideos((current) =>
            current.filter((video) => video.trackSid !== publication.trackSid),
          );
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          setPreviewVideos((current) =>
            current.filter((video) => video.userId !== participant.identity),
          );
        });

        room.on(RoomEvent.TrackPublished, () => {
          syncPreviewSubscriptions(room);
        });

        await room.connect(token.url, token.token, {
          autoSubscribe: false,
        });

        if (!mounted) {
          room.disconnect();
          return;
        }

        setPreviewStatus("connected");
        syncPreviewSubscriptions(room);
      } catch (err) {
        console.error("Waiting room LiveKit preview failed", err);
        if (!mounted) return;
        setPreviewStatus("error");
      }
    }

    void connectPreviewViewer();

    return () => {
      mounted = false;
      setPreviewVideos([]);
      if (localRoom) {
        localRoom.disconnect();
      }
      if (previewRoomRef.current === localRoom) {
        previewRoomRef.current = null;
      }
    };
  }, [livePreviewIds.length, syncPreviewSubscriptions]);

  const timetableMidpoint = Math.ceil(slots.length / 2);
  const timetableColumns = [
    slots.slice(0, timetableMidpoint),
    slots.slice(timetableMidpoint),
  ].filter((column) => column.length > 0);

  const renderTimeRow = (slot: TimetableSlot) => {
    const isCurrent =
      current?.slot === slot.slot && current.startTime === slot.startTime;

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
            Math.round((toSec(slot.endTime) - toSec(slot.startTime)) / 60)}
          분)
        </span>
      </div>
    );
  };

  return (
    <div className="wr">
      <header className="wr-head">
        <div className="wr-head-actions wr-head-actions-left">
          <button
            className="wr-icon-btn"
            aria-label="로그아웃"
            onClick={() => {
              if (!window.confirm("로그아웃하시겠습니까?")) return;
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogoutRoundedIcon className="wr-logout-icon" />
          </button>
          <button
            className="wr-icon-btn"
            aria-label="알림"
            onClick={() => navigate("/inquiry")}
          >
            <NotificationsNoneOutlinedIcon />
          </button>
        </div>

        <div className="wr-title-wrap">
          <h1 className="wr-title">자격증공장 작업 대기장</h1>
          <p className="wr-sub">전문자격 온라인 성인관리형독서실</p>
        </div>

        <button
          className="wr-study-link"
          type="button"
          onClick={() =>
            navigate("/weekly-plan?view=board", { state: { focus: "board" } })
          }
        >
          <FactCheckOutlinedIcon />
          학습장 →
        </button>
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
                {displayWorkingMemberCount}명 근무중
              </span>
              <span className="wr-badge is-wait">
                <i />
                {displayWaitingMemberCount}명 대기중
              </span>
            </div>
          </div>

          <div className="wr-worker-grid">
            {previewMembers.map((worker, index) => {
              const video = previewVideoByUser.get(worker.id);
              return (
                <div
                  className={`wr-worker${video ? " has-video" : ""}${
                    worker.isWorking ? "" : " is-off"
                  }`}
                  key={worker.id}
                  style={
                    video ? undefined : { background: workerGradient(index) }
                  }
                >
                  {video && <WorkerPreviewVideo track={video.track} />}
                  <span className="wr-worker-name">{worker.name}</span>
                  <span
                    className={`wr-worker-state${
                      worker.isWorking ? "" : " is-off"
                    }`}
                  >
                    {worker.isWorking ? "입장" : "대기"}
                  </span>
                </div>
              );
            })}
            {previewMembers.length === 0 && (
              <p className="wr-worker-empty">표시할 작업장 회원이 없습니다.</p>
            )}
          </div>

          <p className="wr-preview-note">
            *현재 접속 중인 사원 중 일부가 랜덤으로 표시됩니다.
            {effectivePreviewStatus === "connecting" && " 연결 중입니다."}
            {effectivePreviewStatus === "error" &&
              " 영상 연결을 확인하지 못했습니다."}
          </p>
        </section>

        <button
          className="wr-notice"
          onClick={() => navigate("/inquiry")}
          type="button"
        >
          <span>공지</span>
          {bellMsg ||
            `관리자 공지: ${current?.label ?? "현재 교시"} 시작 전 카메라 상태를 확인해 주세요.`}
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

        <section className="wr-panel wr-time">
          <div className="wr-panel-head">
            <div className="wr-panel-title">
              <CalendarMonthOutlinedIcon />
              <span>재택근무시간표</span>
            </div>
            <span className="wr-date">{formatDate(now)}</span>
          </div>

          <div className="wr-time-grid">
            {timetableColumns.map((column, index) => (
              <div className="wr-time-column" key={`time-column-${index}`}>
                {column.map(renderTimeRow)}
              </div>
            ))}
          </div>
        </section>

        <section className="wr-attendance">
          <div className="wr-att-main">
            <FactCheckOutlinedIcon />
            <div>
              <span>오늘 출석현황</span>
              <strong>
                {current?.label ?? "대기"} ·{" "}
                {currentAttendanceStatus
                  ? ATTENDANCE_TEXT[currentAttendanceStatus]
                  : "기록 전"}
              </strong>
            </div>
          </div>

          <div className="wr-att-side">
            <span
              className={
                currentAttendanceStatus
                  ? ATTENDANCE_CLASS[currentAttendanceStatus]
                  : ""
              }
            >
              {attendanceCount}/{totalWorkSlots}
            </span>
            <button type="button" onClick={() => navigate("/attendance")}>
              자세히 보기
            </button>
          </div>
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
          <button onClick={() => navigate("/attendance")}>
            <FactCheckOutlinedIcon />
            출석현황
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
