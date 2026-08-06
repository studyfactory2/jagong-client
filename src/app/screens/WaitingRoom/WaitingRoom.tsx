import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
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
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import type { Room } from "livekit-client";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { getMyAttendance } from "../../services/attendance.service";
import { getCamRoomMembers, issueCamToken } from "../../services/cam.service";
import { getMyStudyRoomEntryAccess } from "../../services/study-room-entry.service";
import { getWeeklyStudyLeaderboard } from "../../services/study-statistics.service";
import { getTimetable } from "../../services/timetable.service";
import type {
  AttendanceRecord,
  AttendanceStatusName,
  CamRoomMember,
  StudyRoomEntryAccess,
  StudyRoomEntryAccessChangedPayload,
  TimetableSlot,
  WeeklyStudyLeaderboard,
  WeeklyStudyLeaderboardMember,
} from "../../../lib/types";
import {
  getScheduleSoundEnabled,
  playScheduleTone,
  scheduleBellMessage,
  setScheduleSoundEnabled,
} from "../../utils/schedule-bell";
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

const formatStudyTime = (seconds?: number) => {
  if (seconds === undefined || !Number.isFinite(seconds)) return "--";

  const safeSeconds = Math.max(0, seconds);
  if (safeSeconds > 0 && safeSeconds < 60) return "1분 미만";

  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
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

function studyRoomEntryStatusText(
  access: StudyRoomEntryAccess | null,
  loading: boolean,
  error: string,
) {
  if (loading && !access) return "입장 가능 여부 확인 중";
  if (error || !access) return "입장 가능 여부 확인 필요";

  switch (access.reason) {
    case "OPEN_WINDOW":
      return "입장 가능";
    case "ADMIN_GRANTED":
      return "관리자 입장 허가됨";
    case "ALREADY_IN_ROOM":
      return "작업장 재입장 가능";
    case "STUDY_WINDOW_LOCKED":
      return "교시중 관리자 허가 필요";
    case "TIMETABLE_UNAVAILABLE":
      return "시간표 확인 불가";
  }
}

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

type RemoteVideoTrack = {
  attach: (element?: HTMLMediaElement) => HTMLMediaElement;
  detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
};

type RemoteVideo = {
  trackSid: string;
  userId: string;
  track: RemoteVideoTrack;
};

type FameBoardMember = WeeklyStudyLeaderboardMember & {
  presence: "working" | "waiting" | "unknown";
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
  const { connected, socket, unreadNotificationCount } = useSocket();

  const [slots, setSlots] = useState<TimetableSlot[]>(FALLBACK_TIMETABLE);
  const [now, setNow] = useState(() => new Date());
  const [bellMsg, setBellMsg] = useState("");
  const [scheduleSoundEnabled, setScheduleSoundPreference] = useState(
    getScheduleSoundEnabled,
  );
  const [roomMembers, setRoomMembers] = useState<CamRoomMember[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [weeklyLeaderboard, setWeeklyLeaderboard] =
    useState<WeeklyStudyLeaderboard | null>(null);
  const [weeklyLeaderboardLoading, setWeeklyLeaderboardLoading] =
    useState(true);
  const [weeklyLeaderboardError, setWeeklyLeaderboardError] = useState("");
  const [entryAccess, setEntryAccess] = useState<StudyRoomEntryAccess | null>(
    null,
  );
  const [entryAccessLoading, setEntryAccessLoading] = useState(true);
  const [entryAccessError, setEntryAccessError] = useState("");
  const [previewVideos, setPreviewVideos] = useState<RemoteVideo[]>([]);
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "connecting" | "connected" | "stub" | "error"
  >("idle");
  const bellTimerRef = useRef<number | null>(null);
  const roomMembersRequestRef = useRef(0);
  const weeklyLeaderboardRequestRef = useRef(0);
  const entryAccessRequestRef = useRef(0);
  const scheduleSoundEnabledRef = useRef(scheduleSoundEnabled);
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
    const requestId = roomMembersRequestRef.current + 1;
    roomMembersRequestRef.current = requestId;

    try {
      const members = await getCamRoomMembers();
      if (requestId !== roomMembersRequestRef.current) return;
      setRoomMembers(members);
    } catch {
      // Keep the last successful roster so known presence is not reset to waiting.
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

  const refreshEntryAccess = useCallback(async (showLoading = true) => {
    const requestId = entryAccessRequestRef.current + 1;
    entryAccessRequestRef.current = requestId;
    if (showLoading) setEntryAccessLoading(true);
    setEntryAccessError("");

    try {
      const access = await getMyStudyRoomEntryAccess();
      if (requestId !== entryAccessRequestRef.current) return null;
      setEntryAccess(access);
      return access;
    } catch (error) {
      if (requestId !== entryAccessRequestRef.current) return null;
      setEntryAccess(null);
      setEntryAccessError(
        error instanceof Error
          ? error.message
          : "작업장 입장 가능 여부를 확인하지 못했습니다.",
      );
      return null;
    } finally {
      if (requestId === entryAccessRequestRef.current) {
        setEntryAccessLoading(false);
      }
    }
  }, []);

  const refreshWeeklyLeaderboard = useCallback(async () => {
    const requestId = weeklyLeaderboardRequestRef.current + 1;
    weeklyLeaderboardRequestRef.current = requestId;
    setWeeklyLeaderboardLoading(true);
    setWeeklyLeaderboardError("");

    try {
      const leaderboard = await getWeeklyStudyLeaderboard();
      if (requestId !== weeklyLeaderboardRequestRef.current) return;
      setWeeklyLeaderboard(leaderboard);
    } catch (error) {
      if (requestId !== weeklyLeaderboardRequestRef.current) return;
      setWeeklyLeaderboardError(
        error instanceof Error
          ? error.message
          : "주간 공부 순위를 불러오지 못했습니다.",
      );
    } finally {
      if (requestId === weeklyLeaderboardRequestRef.current) {
        setWeeklyLeaderboardLoading(false);
      }
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
      roomMembersRequestRef.current += 1;
    };
  }, [refreshAttendance, refreshRoomMembers]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refreshWeeklyLeaderboard();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshWeeklyLeaderboard();
    }, 60000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      weeklyLeaderboardRequestRef.current += 1;
    };
  }, [refreshWeeklyLeaderboard]);

  useEffect(() => {
    const refreshWithoutSpinner = () => {
      void refreshEntryAccess(false);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshWithoutSpinner();
    };
    const initialTimer = window.setTimeout(() => {
      void refreshEntryAccess();
    }, 0);
    const timer = window.setInterval(refreshWithoutSpinner, 30000);

    window.addEventListener("focus", refreshWithoutSpinner);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWithoutSpinner);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      entryAccessRequestRef.current += 1;
    };
  }, [refreshEntryAccess]);

  useEffect(() => {
    if (!entryAccess?.windowEndsAt) return;
    const windowEnd = Date.parse(entryAccess.windowEndsAt);
    const delay = windowEnd - Date.now() + 250;
    if (!Number.isFinite(windowEnd) || delay <= 0) return;

    const timer = window.setTimeout(() => {
      setEntryAccess(null);
      void refreshEntryAccess();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [entryAccess?.windowEndsAt, refreshEntryAccess]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    scheduleSoundEnabledRef.current = scheduleSoundEnabled;
  }, [scheduleSoundEnabled]);

  useEffect(() => {
    if (!socket) return;

    const onBell = (data: {
      type: string;
      label?: string;
      messages?: string[];
    }) => {
      void refreshEntryAccess(false);
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
    const onEntryAccessChanged = (
      payload: StudyRoomEntryAccessChangedPayload,
    ) => {
      entryAccessRequestRef.current += 1;
      setEntryAccess(payload);
      setEntryAccessLoading(false);
      setEntryAccessError("");
    };
    const onConnect = () => {
      void refreshEntryAccess(false);
    };

    socket.on("bell", onBell);
    socket.on("cam:join", refreshRoomMembers);
    socket.on("cam:leave", refreshRoomMembers);
    socket.on("connect", onConnect);
    socket.on("study-room:entry-access-changed", onEntryAccessChanged);
    return () => {
      socket.off("bell", onBell);
      socket.off("cam:join", refreshRoomMembers);
      socket.off("cam:leave", refreshRoomMembers);
      socket.off("connect", onConnect);
      socket.off("study-room:entry-access-changed", onEntryAccessChanged);
      if (bellTimerRef.current) {
        window.clearTimeout(bellTimerRef.current);
        bellTimerRef.current = null;
      }
    };
  }, [refreshEntryAccess, refreshRoomMembers, socket]);

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
  const scheduleProgress = Math.min(
    100,
    Math.round((elapsedWorkSeconds / totalWorkSeconds) * 100),
  );
  const countdownTarget = current
    ? toSec(current.endTime) - nowSec
    : nextSlot
      ? toSec(nextSlot.startTime) - nowSec
      : null;
  const canEnterRoom = entryAccess?.canEnter === true;
  const enterStatusText = studyRoomEntryStatusText(
    entryAccess,
    entryAccessLoading,
    entryAccessError,
  );
  const showDefaultEntryDescription =
    canEnterRoom && entryAccess?.reason === "OPEN_WINDOW";
  const scheduleNotice =
    bellMsg ||
    (current?.isBreak
      ? `지금은 ${current.label} 시간입니다. ${current.endTime}까지 편하게 쉬세요.`
      : `관리자 공지: ${current?.label ?? "다음 교시"} 시작 전 카메라 상태를 확인해 주세요.`);

  const toggleScheduleSound = () => {
    const next = !scheduleSoundEnabled;
    setScheduleSoundPreference(next);
    void setScheduleSoundEnabled(next).then((enabled) => {
      if (next && enabled) playScheduleTone("preview");
    });
  };
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
  const workingMemberCount =
    roomMembers?.filter((member) => member.isWorking).length ?? null;
  const weeklyRankedMembers = useMemo(
    () =>
      weeklyLeaderboard?.members.filter(
        (member) =>
          Number.isFinite(member.studySeconds) && member.studySeconds > 0,
      ) ?? [],
    [weeklyLeaderboard],
  );
  const weeklyRecordMemberCount = weeklyLeaderboard
    ? weeklyRankedMembers.length
    : null;
  const fameMembers = useMemo<FameBoardMember[]>(() => {
    if (weeklyRankedMembers.length === 0) return [];

    const roomMemberById = new Map(
      (roomMembers ?? []).map((member) => [member.id, member]),
    );
    const cutoffIndex = Math.min(7, weeklyRankedMembers.length - 1);
    const cutoffSeconds = weeklyRankedMembers[cutoffIndex].studySeconds;

    return weeklyRankedMembers
      .filter((member) => member.studySeconds >= cutoffSeconds)
      .map(
        (member): FameBoardMember => ({
          ...member,
          presence:
            roomMemberById.get(member.userId)?.isWorking === true
              ? "working"
              : roomMemberById.get(member.userId)?.isWorking === false
                ? "waiting"
                : "unknown",
        }),
      );
  }, [roomMembers, weeklyRankedMembers]);
  const livePreviewIds = useMemo(
    () =>
      fameMembers
        .filter((member) => member.presence === "working")
        .slice(0, 8)
        .map((member) => member.userId),
    [fameMembers],
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
            className="wr-icon-btn wr-notification-button"
            aria-label={
              unreadNotificationCount > 0
                ? `읽지 않은 알림 ${unreadNotificationCount}개`
                : "알림"
            }
            onClick={() => navigate("/notifications")}
          >
            <NotificationsNoneOutlinedIcon />
            {unreadNotificationCount > 0 && (
              <span aria-hidden="true" className="wr-notification-badge">
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </span>
            )}
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
        <section
          aria-labelledby="wr-fame-board-title"
          className="wr-panel wr-workers"
        >
          <div className="wr-panel-head">
            <div className="wr-panel-title">
              <EmojiEventsOutlinedIcon />
              <span id="wr-fame-board-title">이번 주 랭킹</span>
            </div>

            <div className="wr-badges">
              <span className="wr-badge is-record">
                <i />
                이번 주 기록 {weeklyRecordMemberCount ?? "--"}명
              </span>
              <span className="wr-badge is-on">
                <i />
                현재 공부중 {workingMemberCount ?? "--"}명
              </span>
            </div>
          </div>

          <div aria-busy={weeklyLeaderboardLoading} className="wr-worker-grid">
            {fameMembers.map((worker, index) => {
              const video = previewVideoByUser.get(worker.userId);
              const isWorking = worker.presence === "working";
              const isWaiting = worker.presence === "waiting";
              return (
                <article
                  aria-label={`${worker.rank}위 ${worker.name}, 이번 주 ${formatStudyTime(worker.studySeconds)}, ${
                    isWorking ? "공부중" : isWaiting ? "대기" : "상태 확인중"
                  }`}
                  className={`wr-worker${video ? " has-video" : ""}${
                    isWaiting ? " is-off" : ""
                  }${worker.presence === "unknown" ? " is-unknown" : ""}${
                    worker.isMe ? " is-me" : ""
                  }${worker.rank <= 3 ? ` is-rank-${worker.rank}` : ""}`}
                  key={worker.userId}
                  style={
                    video ? undefined : { background: workerGradient(index) }
                  }
                >
                  {video && <WorkerPreviewVideo track={video.track} />}

                  <span className="wr-worker-rank">{worker.rank}위</span>
                  <span
                    aria-label={`이번 주 공부시간 ${formatStudyTime(worker.studySeconds)}`}
                    className="wr-worker-study-time"
                    title={formatStudyTime(worker.studySeconds)}
                  >
                    <small>이번 주</small>
                    <strong>{formatStudyTime(worker.studySeconds)}</strong>
                  </span>
                  <span className="wr-worker-name">
                    {worker.name}
                    {worker.isMe && <i>나</i>}
                  </span>
                  <span
                    className={`wr-worker-state${
                      isWaiting
                        ? " is-off"
                        : worker.presence === "unknown"
                          ? " is-unknown"
                          : ""
                    }`}
                  >
                    {isWorking ? "공부중" : isWaiting ? "대기" : "확인중"}
                  </span>
                </article>
              );
            })}
            {fameMembers.length === 0 && (
              <div
                className={`wr-worker-empty${
                  weeklyLeaderboardError ? " is-error" : ""
                }`}
                role={weeklyLeaderboardError ? "alert" : "status"}
              >
                <span>
                  {weeklyLeaderboardLoading && !weeklyLeaderboard
                    ? "주간 공부시간 순위를 불러오는 중입니다."
                    : weeklyLeaderboardError
                      ? weeklyLeaderboardError
                      : "이번 주 공부 기록이 쌓이면 명예의 전당이 열립니다."}
                </span>
                {weeklyLeaderboardError && (
                  <button
                    disabled={weeklyLeaderboardLoading}
                    onClick={() => void refreshWeeklyLeaderboard()}
                    type="button"
                  >
                    다시 시도
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="wr-preview-note" aria-live="polite">
            <span>
              *이번 주 실제 공부시간 기준 1~8위가 표시되며, 공동 순위는 함께
              표시됩니다.
              {effectivePreviewStatus === "connecting" &&
                " 실시간 화면을 연결하고 있습니다."}
              {effectivePreviewStatus === "error" &&
                " 실시간 화면 연결을 확인하지 못했습니다."}
            </span>
            {weeklyLeaderboardError && fameMembers.length > 0 && (
              <>
                <span className="wr-preview-error">
                  최신 순위를 확인하지 못해 이전 기록을 표시합니다.
                </span>
                <button
                  disabled={weeklyLeaderboardLoading}
                  onClick={() => void refreshWeeklyLeaderboard()}
                  type="button"
                >
                  다시 시도
                </button>
              </>
            )}
          </div>
        </section>

        <section className="wr-schedule-notice" aria-live="polite">
          <button
            className="wr-notice"
            onClick={() => navigate("/inquiry")}
            type="button"
          >
            <span>{bellMsg || current?.isBreak ? "일정" : "공지"}</span>
            {scheduleNotice}
          </button>
          <button
            className={`wr-sound-toggle${scheduleSoundEnabled ? " is-on" : ""}`}
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

        <section aria-busy={entryAccessLoading} className="wr-entry">
          <button
            className="wr-entry-btn is-private"
            disabled={!canEnterRoom}
            onClick={() => navigate("/study-line")}
            type="button"
          >
            <DoorFrontOutlinedIcon />
            <span>
              <strong>개인 작업실 입장</strong>
              <em>
                {showDefaultEntryDescription
                  ? "나만의 집중 작업실"
                  : enterStatusText}
              </em>
            </span>
          </button>

          <button
            className="wr-entry-btn is-group"
            disabled={!canEnterRoom}
            onClick={() => navigate("/study-room")}
            type="button"
          >
            <GroupsOutlinedIcon />
            <span>
              <strong>단체 작업장 입장</strong>
              <em>
                {showDefaultEntryDescription
                  ? "전국 사원과 함께 입장"
                  : enterStatusText}
              </em>
            </span>
          </button>

          {entryAccessError && (
            <div className="wr-entry-status is-error" role="alert">
              <span>{entryAccessError}</span>
              <button
                disabled={entryAccessLoading}
                onClick={() => void refreshEntryAccess()}
                type="button"
              >
                {entryAccessLoading ? "확인 중" : "다시 확인"}
              </button>
            </div>
          )}
        </section>

        <section className="wr-progress">
          <div className="wr-progress-card">
            <span>오늘 일정 진행률</span>
            <strong>{scheduleProgress}%</strong>
            <em>
              {completedWorkSlots}/{totalWorkSlots}교시
            </em>
            <div className="wr-progress-bar">
              <i style={{ width: `${scheduleProgress}%` }} />
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
            작업계획
          </button>
          <button onClick={() => navigate("/leaves")}>
            <LockOutlinedIcon />
            휴가내역 및 신청
          </button>
          <button onClick={() => navigate("/study-records")}>
            <QueryStatsOutlinedIcon />
            공부기록
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
