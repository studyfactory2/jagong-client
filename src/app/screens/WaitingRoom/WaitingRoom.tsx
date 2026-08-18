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
import type { Room } from "livekit-client";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { getMyAttendance } from "../../services/attendance.service";
import { getCamRoomMembers, issueCamToken } from "../../services/cam.service";
import { getMyStudyRoomEntryAccess } from "../../services/study-room-entry.service";
import {
  getMyStudyStatistics,
  getWeeklyStudyLeaderboard,
} from "../../services/study-statistics.service";
import { getTimetable } from "../../services/timetable.service";
import {
  getAttendanceArrivalDetail,
} from "../../utils/attendance-display";
import type {
  AttendanceRecord,
  AttendanceStatusName,
  CamRoomMember,
  MyStudyStatistics,
  StudyRoomEntryAccess,
  StudyRoomEntryAccessChangedPayload,
  TimetableSlot,
  WeeklyStudyLeaderboard,
  WeeklyStudyLeaderboardMember,
  WorkroomMode,
} from "../../../lib/types";
import {
  getScheduleSoundEnabled,
  getWorkdayAnnouncement,
  playScheduleTone,
  type ScheduleBellEvent,
} from "../../utils/schedule-bell";
import WaitingRoomNotificationHub, {
  type NotificationHubDestination,
} from "./WaitingRoomNotificationHub";
import { resolveParticipantWorkroomMode } from "../../utils/workroom-mode";
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

const SEOUL_TIME_ZONE = "Asia/Seoul";
const seoulDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

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

const seoulClockFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const formatStudyStatisticsTime = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${seoulClockFormatter.format(parsed)} 기준`;
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

type AttendancePeriodView = {
  className: string;
  label: string;
  shortLabel: string;
};

function isAttendanceStatus(value?: string): value is AttendanceStatusName {
  return Boolean(value && value in ATTENDANCE_TEXT);
}

function attendancePeriodView(
  slot: TimetableSlot,
  displayNumber: number,
  record: AttendanceRecord | undefined,
  nowSeconds: number,
): AttendancePeriodView {
  if (record && isAttendanceStatus(record.status)) {
    const detail: string[] = [
      `${displayNumber}교시`,
      ATTENDANCE_TEXT[record.status],
    ];

    const arrival = getAttendanceArrivalDetail(record);
    if (arrival?.lateDuration) {
      detail.push(`${arrival.lateDuration} 늦게 입실`);
    }
    if (arrival?.firstStudyClock) {
      detail.push(`공부 시작 ${arrival.firstStudyClock}`);
    }

    if (record.status === "EXCUSED") {
      const reason = record.reason?.trim() || record.reasonType?.trim();
      if (reason) detail.push(reason);
    }

    return {
      className: ATTENDANCE_CLASS[record.status],
      label: detail.join(" · "),
      shortLabel:
        record.status === "EXCUSED" ? "사유" : ATTENDANCE_TEXT[record.status],
    };
  }

  const startsAt = toSec(slot.startTime);
  const endsAt = toSec(slot.endTime);
  if (nowSeconds < startsAt) {
    return {
      className: "is-upcoming",
      label: `${displayNumber}교시 · 예정`,
      shortLabel: "예정",
    };
  }
  if (nowSeconds < endsAt) {
    return {
      className: "is-checking",
      label: `${displayNumber}교시 · 출석 확인 중`,
      shortLabel: "확인중",
    };
  }
  return {
    className: "is-unrecorded",
    label: `${displayNumber}교시 · 미기록`,
    shortLabel: "미기록",
  };
}

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
    case "ABSENT_ENTRY_ALLOWED":
      return "입장 가능 · 결석 처리 기준 시간 경과";
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

function seoulDateTimeParts(date: Date) {
  const parts = seoulDateTimeFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: Number(part("hour")),
    minute: Number(part("minute")),
    second: Number(part("second")),
  };
}

function isoDate(date: Date) {
  const { year, month, day } = seoulDateTimeParts(date);
  return `${year}-${month}-${day}`;
}

function seoulSecondOfDay(date: Date) {
  const { hour, minute, second } = seoulDateTimeParts(date);
  return hour * 3600 + minute * 60 + second;
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
  workroomMode: WorkroomMode;
};

type FameBoardMember = WeeklyStudyLeaderboardMember & {
  presence: "working" | "waiting" | "unknown";
};

function WorkerPreviewVideo({
  blurred,
  track,
}: {
  blurred: boolean;
  track: RemoteVideoTrack;
}) {
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
      className={`wr-worker-video${blurred ? " is-line-blurred" : ""}`}
    />
  );
}

export default function WaitingRoom() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const { connected, socket, unreadNotificationCount } = useSocket();

  const [slots, setSlots] = useState<TimetableSlot[]>(FALLBACK_TIMETABLE);
  const [now, setNow] = useState(() => new Date());
  const [roomMembers, setRoomMembers] = useState<CamRoomMember[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [weeklyLeaderboard, setWeeklyLeaderboard] =
    useState<WeeklyStudyLeaderboard | null>(null);
  const [weeklyLeaderboardLoading, setWeeklyLeaderboardLoading] =
    useState(true);
  const [weeklyLeaderboardError, setWeeklyLeaderboardError] = useState("");
  const [studyStatistics, setStudyStatistics] =
    useState<MyStudyStatistics | null>(null);
  const [studyStatisticsLoading, setStudyStatisticsLoading] = useState(true);
  const [studyStatisticsError, setStudyStatisticsError] = useState("");
  const [entryAccess, setEntryAccess] = useState<StudyRoomEntryAccess | null>(
    null,
  );
  const [entryAccessLoading, setEntryAccessLoading] = useState(true);
  const [entryAccessError, setEntryAccessError] = useState("");
  const [previewVideos, setPreviewVideos] = useState<RemoteVideo[]>([]);
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "connecting" | "connected" | "stub" | "error"
  >("idle");
  const [notificationHubOpen, setNotificationHubOpen] = useState(false);
  const roomMembersRequestRef = useRef(0);
  const weeklyLeaderboardRequestRef = useRef(0);
  const studyStatisticsRequestRef = useRef(0);
  const entryAccessRequestRef = useRef(0);
  const previewRoomRef = useRef<Room | null>(null);
  const previewIdsRef = useRef<string[]>([]);
  const previewReconnectRef = useRef<(manual?: boolean) => void>(() => {});

  const openNotificationDestination = (
    destination: NotificationHubDestination,
  ) => {
    setNotificationHubOpen(false);
    if (destination === "notifications") {
      navigate("/notifications");
      return;
    }
    navigate(`/inquiry?view=${destination}`);
  };

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
      // Preserve the last successful result; the date filter below prevents
      // yesterday's records from appearing after the Seoul day changes.
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

  const refreshStudyStatistics = useCallback(async () => {
    const requestId = studyStatisticsRequestRef.current + 1;
    studyStatisticsRequestRef.current = requestId;
    setStudyStatisticsLoading(true);
    setStudyStatisticsError("");

    try {
      const statistics = await getMyStudyStatistics();
      if (requestId !== studyStatisticsRequestRef.current) return;
      setStudyStatistics(statistics);
    } catch (error) {
      if (requestId !== studyStatisticsRequestRef.current) return;
      setStudyStatisticsError(
        error instanceof Error
          ? error.message
          : "공부시간 리포트를 불러오지 못했습니다.",
      );
    } finally {
      if (requestId === studyStatisticsRequestRef.current) {
        setStudyStatisticsLoading(false);
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
    const refreshAttendanceWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshAttendance();
    };
    window.addEventListener("focus", refreshAttendance);
    document.addEventListener("visibilitychange", refreshAttendanceWhenVisible);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshAttendance);
      document.removeEventListener(
        "visibilitychange",
        refreshAttendanceWhenVisible,
      );
      roomMembersRequestRef.current += 1;
    };
  }, [refreshAttendance, refreshRoomMembers]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refreshWeeklyLeaderboard();
      void refreshStudyStatistics();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshWeeklyLeaderboard();
      void refreshStudyStatistics();
    }, 60000);

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshStudyStatistics();
    };
    window.addEventListener("focus", refreshStudyStatistics);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshStudyStatistics);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      weeklyLeaderboardRequestRef.current += 1;
      studyStatisticsRequestRef.current += 1;
    };
  }, [refreshStudyStatistics, refreshWeeklyLeaderboard]);

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
    if (!socket) return;

    const onBell = (data: ScheduleBellEvent) => {
      void refreshEntryAccess(false);
      if (getWorkdayAnnouncement(data)) return;
      if (getScheduleSoundEnabled()) playScheduleTone(data.type);
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
    };
  }, [refreshEntryAccess, refreshRoomMembers, socket]);

  const nowSec = seoulSecondOfDay(now);
  const todayDate = isoDate(now);

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
  const canUseAdmin =
    session?.user.role === "ADMIN" || session?.user.role === "STAFF";
  const attendanceBySlot = useMemo(
    () =>
      new Map(
        attendance
          .filter((record) => String(record.date).slice(0, 10) === todayDate)
          .map((record) => [record.slot, record]),
      ),
    [attendance, todayDate],
  );
  const weeklyRankedMembers = useMemo(
    () =>
      weeklyLeaderboard?.members.filter(
        (member) =>
          Number.isFinite(member.studySeconds) && member.studySeconds > 0,
      ) ?? [],
    [weeklyLeaderboard],
  );
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
  const hasLivePreviews = livePreviewIds.length > 0;
  const effectivePreviewStatus = hasLivePreviews ? previewStatus : "idle";
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
    if (!hasLivePreviews) {
      return undefined;
    }

    let mounted = true;
    let localRoom: Room | null = null;
    let reconnectAttempts = 0;
    let reconnectTimer: number | null = null;
    let connectInFlight = false;
    let reconnectRequested = false;
    let accessRevoked = false;

    const clearCurrentRoom = (room: Room) => {
      if (localRoom === room) localRoom = null;
      if (previewRoomRef.current === room) previewRoomRef.current = null;
    };

    const scheduleReconnect = () => {
      if (!mounted || reconnectTimer !== null || localRoom) return;
      if (accessRevoked) return;
      if (document.visibilityState !== "visible" || !navigator.onLine) {
        setPreviewStatus("error");
        return;
      }
      if (connectInFlight) {
        reconnectRequested = true;
        return;
      }
      if (reconnectAttempts >= 1) {
        setPreviewStatus("error");
        return;
      }

      reconnectAttempts += 1;
      setPreviewStatus("connecting");
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (!mounted) return;
        if (document.visibilityState !== "visible" || !navigator.onLine) {
          reconnectAttempts = 0;
          setPreviewStatus("error");
          return;
        }
        void connectPreviewViewer();
      }, reconnectAttempts * 1500);
    };

    const recoverPreview = (manual = false) => {
      if (!mounted || localRoom || connectInFlight || reconnectTimer !== null) {
        return;
      }
      if (accessRevoked && !manual) return;
      if (document.visibilityState !== "visible" || !navigator.onLine) {
        setPreviewStatus("error");
        return;
      }

      accessRevoked = false;
      reconnectAttempts = 0;
      reconnectRequested = false;
      setPreviewStatus("connecting");
      void connectPreviewViewer();
    };

    const recoverWhenVisible = () => {
      if (document.visibilityState === "visible") recoverPreview();
    };
    const recoverWhenAvailable = () => recoverPreview();

    previewReconnectRef.current = recoverPreview;
    window.addEventListener("online", recoverWhenAvailable);
    window.addEventListener("pageshow", recoverWhenAvailable);
    document.addEventListener("visibilitychange", recoverWhenVisible);

    async function connectPreviewViewer() {
      if (!mounted || localRoom || connectInFlight) return;

      connectInFlight = true;
      let connectingRoom: Room | null = null;

      try {
        setPreviewStatus("connecting");
        const token = await issueCamToken({ preview: true });

        if (!mounted) return;

        if (!token.url || token.token.startsWith("stub.")) {
          setPreviewStatus("stub");
          return;
        }

        const { DisconnectReason, Room, RoomEvent } =
          await import("livekit-client");
        if (!mounted) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        connectingRoom = room;
        localRoom = room;
        previewRoomRef.current = room;

        room.on(
          RoomEvent.TrackSubscribed,
          (track, publication, participant) => {
            if (!mounted || localRoom !== room) return;
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
                  workroomMode: resolveParticipantWorkroomMode(
                    participant.attributes,
                  ),
                },
              ];
            });
          },
        );

        room.on(
          RoomEvent.ParticipantAttributesChanged,
          (_changedAttributes, participant) => {
            if (!mounted || localRoom !== room) return;
            const workroomMode = resolveParticipantWorkroomMode(
              participant.attributes,
            );
            setPreviewVideos((current) =>
              current.map((video) =>
                video.userId === participant.identity
                  ? { ...video, workroomMode }
                  : video,
              ),
            );
          },
        );

        room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
          if (!mounted || localRoom !== room) return;
          setPreviewVideos((current) =>
            current.filter((video) => video.trackSid !== publication.trackSid),
          );
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (!mounted || localRoom !== room) return;
          setPreviewVideos((current) =>
            current.filter((video) => video.userId !== participant.identity),
          );
        });

        room.on(RoomEvent.TrackPublished, () => {
          if (!mounted || localRoom !== room) return;
          syncPreviewSubscriptions(room);
        });

        room.on(RoomEvent.Reconnecting, () => {
          if (!mounted || localRoom !== room) return;
          setPreviewStatus("connecting");
        });

        room.on(RoomEvent.Reconnected, () => {
          if (!mounted || localRoom !== room) return;
          reconnectAttempts = 0;
          reconnectRequested = false;
          setPreviewStatus("connected");
          syncPreviewSubscriptions(room);
        });

        room.on(RoomEvent.Disconnected, (reason) => {
          if (!mounted || localRoom !== room) return;

          console.warn("Waiting room LiveKit preview disconnected", {
            reason,
            visibilityState: document.visibilityState,
            online: navigator.onLine,
            reconnectAttempts,
          });

          clearCurrentRoom(room);
          setPreviewVideos([]);

          if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
            accessRevoked = true;
            console.warn(
              "Waiting room LiveKit preview access was revoked by the server",
            );
            setPreviewStatus("error");
            return;
          }

          scheduleReconnect();
        });

        await room.connect(token.url, token.token, {
          autoSubscribe: false,
        });

        if (!mounted || localRoom !== room) {
          room.disconnect();
          return;
        }

        reconnectAttempts = 0;
        reconnectRequested = false;
        accessRevoked = false;
        setPreviewStatus("connected");
        syncPreviewSubscriptions(room);
      } catch (err) {
        console.error("Waiting room LiveKit preview failed", err);
        if (!mounted) return;

        if (accessRevoked) {
          setPreviewStatus("error");
          return;
        }

        const failedRoom = connectingRoom;
        if (failedRoom) {
          clearCurrentRoom(failedRoom);
          void failedRoom.disconnect();
        }
        setPreviewVideos([]);
        connectInFlight = false;
        scheduleReconnect();
        return;
      } finally {
        connectInFlight = false;
        if (reconnectRequested) {
          reconnectRequested = false;
          scheduleReconnect();
        }
      }
    }

    void connectPreviewViewer();

    return () => {
      mounted = false;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      window.removeEventListener("online", recoverWhenAvailable);
      window.removeEventListener("pageshow", recoverWhenAvailable);
      document.removeEventListener("visibilitychange", recoverWhenVisible);
      if (previewReconnectRef.current === recoverPreview) {
        previewReconnectRef.current = () => {};
      }
      setPreviewVideos([]);
      if (localRoom) {
        localRoom.disconnect();
      }
      if (previewRoomRef.current === localRoom) {
        previewRoomRef.current = null;
      }
    };
  }, [hasLivePreviews, syncPreviewSubscriptions]);

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
            aria-expanded={notificationHubOpen}
            aria-haspopup="dialog"
            aria-label={
              unreadNotificationCount > 0
                ? `알림센터, 읽지 않은 관리자 알림 ${unreadNotificationCount}개`
                : "알림센터"
            }
            onClick={() => setNotificationHubOpen(true)}
            type="button"
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

          </div>

          <div aria-busy={weeklyLeaderboardLoading} className="wr-worker-grid">
            {fameMembers.map((worker, index) => {
              const video = previewVideoByUser.get(worker.userId);
              const isWorking = worker.presence === "working";
              const isWaiting = worker.presence === "waiting";
              const isLineBlurred = Boolean(
                video && !worker.isMe && video.workroomMode === "line",
              );
              return (
                <article
                  aria-label={`${worker.rank}위 ${worker.name}, ${formatStudyTime(worker.studySeconds)}, ${
                    isWorking
                      ? "카메라 연결됨"
                      : isWaiting
                        ? "카메라 미연결"
                        : "카메라 상태 확인 중"
                  }`}
                  className={`wr-worker${video ? " has-video" : ""}${
                    isWaiting ? " is-off" : ""
                  }${worker.presence === "unknown" ? " is-unknown" : ""}${
                    isWorking ? " is-camera-connected" : ""
                  }${worker.isMe ? " is-me" : ""}${
                    worker.rank <= 3 ? ` is-rank-${worker.rank}` : ""
                  }`}
                  key={worker.userId}
                  style={
                    video ? undefined : { background: workerGradient(index) }
                  }
                >
                  {video && (
                    <WorkerPreviewVideo
                      blurred={isLineBlurred}
                      track={video.track}
                    />
                  )}

                  <span className="wr-worker-rank">{worker.rank}위</span>
                  <span
                    aria-label={`이번 주 공부시간 ${formatStudyTime(worker.studySeconds)}`}
                    className="wr-worker-study-time"
                    title={formatStudyTime(worker.studySeconds)}
                  >
                    <strong>{formatStudyTime(worker.studySeconds)}</strong>
                  </span>
                  <span className="wr-worker-name">
                    {worker.name}
                    {worker.isMe && <i>나</i>}
                  </span>
                  {!isWorking && (
                    <span
                      className={`wr-worker-state${
                        isWaiting ? " is-off" : " is-unknown"
                      }`}
                    >
                      {isWaiting ? "대기" : "확인중"}
                    </span>
                  )}
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

          {(effectivePreviewStatus === "connecting" ||
            effectivePreviewStatus === "error" ||
            (weeklyLeaderboardError && fameMembers.length > 0)) && (
            <div className="wr-preview-note" aria-live="polite">
              {effectivePreviewStatus === "connecting" && (
                <span>실시간 화면을 연결하고 있습니다.</span>
              )}
              {effectivePreviewStatus === "error" && (
                <>
                  <span>실시간 화면 연결을 확인하지 못했습니다.</span>
                  <button
                    onClick={() => previewReconnectRef.current(true)}
                    type="button"
                  >
                    화면 다시 연결
                  </button>
                </>
              )}
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
          )}
        </section>

        <section
          aria-busy={studyStatisticsLoading}
          aria-labelledby="wr-study-report-title"
          className="wr-study-report"
        >
          <div className="wr-study-report-head">
            <div className="wr-study-report-title">
              <QueryStatsOutlinedIcon />
              <div>
                <strong id="wr-study-report-title">나의 작업시간 리포트</strong>
                <span>
                  {formatStudyStatisticsTime(studyStatistics?.generatedAt) ??
                    (studyStatisticsLoading ? "집계 중" : "집계 시간 확인 중")}
                </span>
              </div>
            </div>
            <button type="button" onClick={() => navigate("/study-records")}>
              자세히 보기
            </button>
          </div>

          <div className="wr-study-report-metrics">
            {[
              {
                label: "오늘",
                seconds: studyStatistics?.today.studySeconds,
              },
              {
                label: "이번 주",
                seconds: studyStatistics?.currentWeek.studySeconds,
              },
              {
                label: "이번 달",
                seconds: studyStatistics?.currentMonth.studySeconds,
              },
            ].map(({ label, seconds }) => {
              const value = formatStudyTime(
                typeof seconds === "number" ? seconds : undefined,
              );
              return (
                <div
                  aria-label={`${label} 실제 공부시간 ${value}`}
                  className="wr-study-report-metric"
                  key={label}
                >
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              );
            })}
          </div>

          {studyStatisticsError && (
            <div className="wr-study-report-status" role="alert">
              <span>
                {studyStatistics
                  ? "최신 공부시간을 확인하지 못해 이전 집계를 표시합니다."
                  : studyStatisticsError}
              </span>
              <button
                disabled={studyStatisticsLoading}
                onClick={() => void refreshStudyStatistics()}
                type="button"
              >
                {studyStatisticsLoading ? "확인 중" : "다시 시도"}
              </button>
            </div>
          )}
        </section>

        <section
          aria-labelledby="wr-attendance-strip-title"
          className="wr-attendance-strip"
        >
          <header className="wr-attendance-strip-head">
            <div>
              <FactCheckOutlinedIcon aria-hidden="true" />
              <div>
                <strong id="wr-attendance-strip-title">
                  오늘 나의 출석현황
                </strong>
              </div>
            </div>
            <button type="button" onClick={() => navigate("/attendance")}>
              자세히 보기
            </button>
          </header>

          <ol
            className="wr-attendance-periods"
            aria-label="오늘 교시별 출석 상태"
          >
            {workPeriodSlots.map((slot, index) => {
              const view = attendancePeriodView(
                slot,
                index + 1,
                attendanceBySlot.get(slot.slot),
                nowSec,
              );
              return (
                <li key={slot.slot}>
                  <span
                    aria-label={view.label}
                    className={`wr-attendance-period ${view.className}`}
                    role="img"
                    title={view.label}
                  >
                    {index + 1}
                  </span>
                  <small className={view.className}>{view.shortLabel}</small>
                </li>
              );
            })}
          </ol>

          <div
            className="wr-attendance-legend"
            aria-label="출석 상태 색상 안내"
          >
            <span className="is-present">출석</span>
            <span className="is-late">지각</span>
            <span className="is-absent">결석</span>
            <span className="is-excused">사유 인정</span>
            <span className="is-pending">예정·미기록</span>
          </div>
        </section>

        <section aria-busy={entryAccessLoading} className="wr-entry">
          <button
            className="wr-entry-btn is-private"
            disabled={!canEnterRoom}
            onClick={() => navigate("/workroom/prepare?mode=line")}
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
            onClick={() => navigate("/workroom/prepare?mode=group")}
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

        <section className="wr-shortcuts">
          <button onClick={() => navigate("/weekly-plan")}>
            <EventNoteOutlinedIcon />
            작업계획
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

      <WaitingRoomNotificationHub
        onClose={() => setNotificationHubOpen(false)}
        onSelect={openNotificationDestination}
        open={notificationHubOpen}
        unreadNotificationCount={unreadNotificationCount}
      />
    </div>
  );
}
