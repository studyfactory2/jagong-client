import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import WorkroomCameraSetup from "../../components/WorkroomCameraSetup";
import StudyBreakConfirmDialog from "../../components/ui/StudyBreakConfirmDialog";
import { getTimetable } from "../../services/timetable.service";
import type { TimetableSlot } from "../../../lib/types";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import {
  useWorkroomSession,
  type RemoteVideo,
  type RemoteVideoTrack,
} from "../../context/WorkroomSessionContext";
import {
  getScheduleSoundEnabled,
  playScheduleTone,
  scheduleBellMessage,
  setScheduleSoundEnabled,
} from "../../utils/schedule-bell";
import "./study-room.css";

const getCameraPageSize = () => {
  if (typeof window === "undefined") return 8;
  if (window.innerWidth >= 1200) return 20;
  if (window.innerWidth >= 560) return 12;
  return 8;
};

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

const toMin = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

const seoulClockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function seoulMinutesSinceMidnight(date: Date): number {
  const parts = seoulClockFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return value("hour") * 60 + value("minute");
}

function isClockInSlot(slot: TimetableSlot) {
  return slot.slot === 0 || slot.label.includes("출근");
}

function isAttendanceSlot(slot: TimetableSlot) {
  return !slot.isBreak && !isClockInSlot(slot);
}

function currentSlot(
  timetable: TimetableSlot[],
  referenceAt = new Date(),
): number | null {
  const nowMin = seoulMinutesSinceMidnight(referenceAt);
  const period = timetable.find((slot) => {
    if (!isAttendanceSlot(slot)) return false;
    return toMin(slot.startTime) <= nowMin && nowMin < toMin(slot.endTime);
  });
  return period?.slot ?? null;
}

function timeLeftText(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours <= 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function formatTodayStudyTime(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "--:--:--";

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;

  return [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function StudyRoomRemoteVideo({ track }: { track: RemoteVideoTrack }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return undefined;

    track.attach(element);
    void element.play().catch(() => undefined);

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
      className="sr-cam-remote-video"
    />
  );
}

export default function StudyRoom() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { socket } = useSocket();
  const {
    joined,
    joining,
    cameraPausedForBreak,
    error,
    localVideoTrack,
    devices,
    selectedDeviceId,
    roomMembers,
    remoteVideos,
    studyStatus,
    studyStatusLoading,
    studyStatusError,
    studyActionPending,
    selectCamera,
    startSession,
    leaveSession,
    syncAttendanceSlot,
    refreshStudyStatus,
    startStudyBreak,
    resumeStudy,
    setVisibleRemoteUserIds,
  } = useWorkroomSession();
  const [compactWall, setCompactWall] = useState(true);
  const [cameraOnly, setCameraOnly] = useState(false);
  const [cameraPage, setCameraPage] = useState(0);
  const [cameraPageSize, setCameraPageSize] = useState(getCameraPageSize);
  const [timetable, setTimetable] =
    useState<TimetableSlot[]>(FALLBACK_TIMETABLE);
  const [now, setNow] = useState(() => new Date());
  const [bellMsg, setBellMsg] = useState("");
  const [scheduleSoundEnabled, setScheduleSoundPreference] = useState(
    getScheduleSoundEnabled,
  );
  const [breakConfirmOpen, setBreakConfirmOpen] = useState(false);
  const selfTileVideoRef = useRef<HTMLVideoElement | null>(null);
  const bellTimerRef = useRef<number | null>(null);
  const scheduleSoundEnabledRef = useRef(scheduleSoundEnabled);
  const myId = session?.user.userId ?? session?.user.id ?? "";
  const myName = session?.user.name ?? "나";

  useEffect(() => {
    const updatePageSize = () => {
      setCameraPageSize((currentSize) => {
        const nextSize = getCameraPageSize();
        return currentSize === nextSize ? currentSize : nextSize;
      });
    };

    updatePageSize();
    window.addEventListener("resize", updatePageSize);
    return () => window.removeEventListener("resize", updatePageSize);
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

  useEffect(() => {
    getTimetable()
      .then((items) => {
        if (!items.length) return;
        setTimetable(
          [...items].sort((a, b) => toMin(a.startTime) - toMin(b.startTime)),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const attendanceSlot = useMemo(
    () => currentSlot(timetable, now),
    [now, timetable],
  );

  useEffect(() => {
    if (!joined) return;
    syncAttendanceSlot(attendanceSlot ?? undefined);
  }, [attendanceSlot, joined, syncAttendanceSlot]);

  const attachSelfTileVideo = useCallback(
    (element: HTMLVideoElement | null) => {
      const previousElement = selfTileVideoRef.current;

      if (previousElement && localVideoTrack) {
        localVideoTrack.detach(previousElement);
      }

      selfTileVideoRef.current = element;
      if (!element || !joined || cameraPausedForBreak || !localVideoTrack) {
        return;
      }

      localVideoTrack.attach(element);
      void element.play().catch(() => undefined);
    },
    [cameraPausedForBreak, joined, localVideoTrack],
  );

  const nowMin = seoulMinutesSinceMidnight(now);
  const current = useMemo(() => {
    const matches = timetable.filter(
      (slot) => toMin(slot.startTime) <= nowMin && nowMin < toMin(slot.endTime),
    );
    return matches.length === 1 ? matches[0] : undefined;
  }, [nowMin, timetable]);
  const nextSlot = useMemo(
    () => timetable.find((slot) => toMin(slot.startTime) > nowMin),
    [nowMin, timetable],
  );
  const remainingMinutes = current
    ? toMin(current.endTime) - nowMin
    : nextSlot
      ? toMin(nextSlot.startTime) - nowMin
      : 0;
  const remainingLabel = current
    ? "종료까지"
    : nextSlot
      ? "시작까지"
      : "오늘 종료";
  const remainingText = timeLeftText(remainingMinutes);
  const periodWindow = current
    ? `${current.startTime} - ${current.endTime}`
    : nextSlot
      ? `${nextSlot.startTime} 시작`
      : "오늘 일정 완료";
  const nextWindow = nextSlot
    ? `${nextSlot.startTime} - ${nextSlot.endTime}`
    : "오늘 일정 완료";
  const noticeBody =
    bellMsg ||
    (current?.isBreak
      ? `지금은 ${current.label} 시간입니다. ${current.endTime}까지 편하게 쉬세요.`
      : current
        ? `${current.label} 집중 체크 중입니다. 화면을 켜고 자리를 유지해 주세요.`
        : nextSlot
          ? `${nextSlot.label} 시작 전입니다. 입장 상태와 카메라를 확인해 주세요.`
          : "오늘 작업장 일정이 종료되었습니다.");
  const isStudying =
    studyStatus?.active === true && studyStatus.state === "STUDY";
  const isMemberBreak =
    studyStatus?.active === true &&
    studyStatus.state === "BREAK" &&
    studyStatus.source === "MEMBER";
  const isScheduleBreak =
    studyStatus?.active === true &&
    studyStatus.state === "BREAK" &&
    studyStatus.source === "SCHEDULE";
  const isSystemBreak =
    studyStatus?.active === true &&
    studyStatus.state === "BREAK" &&
    studyStatus.source === "SYSTEM";
  const isStudyStatusPending = !(
    studyStatus?.active &&
    studyStatus.state &&
    studyStatus.source
  );
  const isTimetableBreak = Boolean(
    current && current.isBreak && !isClockInSlot(current),
  );
  const isCountedStudy =
    isStudying && studyStatus?.source !== "SYSTEM" && !cameraPausedForBreak;
  const isIntentionalBreak =
    studyStatus?.active === true && (cameraPausedForBreak || isMemberBreak);
  const isBreakTransitionPending =
    isTimetableBreak &&
    !isStudyStatusPending &&
    studyStatus?.state === "BREAK" &&
    studyStatus.source !== "MEMBER" &&
    studyStatus.source !== "SYSTEM" &&
    studyStatus.source !== "ADMIN";
  const studyAction = isIntentionalBreak
    ? "RESUME"
    : isCountedStudy
      ? "BREAK"
      : null;
  const studyStateLabel = isIntentionalBreak
    ? "휴식 중"
    : isCountedStudy
      ? isTimetableBreak
        ? "휴식시간 공부 중"
        : "공부 중"
      : isBreakTransitionPending
        ? "정규 휴식 전환 중"
        : studyStatus?.source === "ADMIN"
          ? "관리자 상태 확인 필요"
          : isScheduleBreak
            ? "정규 휴식"
            : isSystemBreak
              ? "카메라 확인 필요"
              : studyStatusLoading
                ? "공부 상태 연결 중"
                : studyStatus?.active === false
                  ? "카메라 등록 대기"
                  : "공부 기록 연결 대기";
  const studyStateDescription = isIntentionalBreak
    ? "계속 공부하기를 누르면 카메라와 공부시간 기록을 다시 시작합니다."
    : isCountedStudy
      ? "실제 공부시간에 포함되고 있습니다."
      : isBreakTransitionPending
        ? "서버의 정규 휴식 전환을 확인하고 있습니다."
        : studyStatus?.source === "ADMIN"
          ? "관리자가 설정한 공부 상태입니다."
          : isScheduleBreak
            ? "시간표에 따른 정규 쉬는시간입니다."
            : isSystemBreak
              ? "카메라 연결을 복구하면 상태를 다시 확인합니다."
              : studyStatusLoading
                ? "서버 기록을 연결하고 있습니다."
                : studyStatus?.active === false
                  ? "카메라 등록이 완료되면 공부시간 기록이 자동으로 시작됩니다."
                  : "서버의 현재 공부 기록 연결을 기다리고 있습니다.";
  const studyStateTone = isIntentionalBreak
    ? "break"
    : isCountedStudy
      ? "study"
      : isBreakTransitionPending
        ? "syncing"
        : studyStatus?.source === "ADMIN" || isSystemBreak
          ? "system"
          : isScheduleBreak
            ? "schedule"
            : "syncing";
  const studyActionDisabled =
    studyStatusLoading ||
    Boolean(studyStatusError) ||
    studyActionPending !== null;

  const toggleScheduleSound = () => {
    const next = !scheduleSoundEnabled;
    setScheduleSoundPreference(next);
    void setScheduleSoundEnabled(next).then((enabled) => {
      if (next && enabled) playScheduleTone("preview");
    });
  };
  const membersForGrid = useMemo(() => {
    const withSelfStatus = roomMembers.map((member) =>
      member.id === myId
        ? { ...member, isWorking: joined || member.isWorking }
        : member,
    );

    if (myId && !withSelfStatus.some((member) => member.id === myId)) {
      withSelfStatus.unshift({
        id: myId,
        name: myName,
        isWorking: joined,
        joinedAt: joined ? new Date().toISOString() : null,
      });
    }

    return [...withSelfStatus].sort((a, b) => {
      if (a.id === myId) return -1;
      if (b.id === myId) return 1;
      if (a.isWorking !== b.isWorking) return a.isWorking ? -1 : 1;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [joined, myId, myName, roomMembers]);
  const selfMember = useMemo(
    () => membersForGrid.find((member) => member.id === myId),
    [membersForGrid, myId],
  );
  const pageableMembers = useMemo(
    () => membersForGrid.filter((member) => member.id !== myId),
    [membersForGrid, myId],
  );
  const pageableCameraCount = Math.max(
    1,
    cameraPageSize - (selfMember ? 1 : 0),
  );
  const cameraPageCount = Math.max(
    1,
    Math.ceil(pageableMembers.length / pageableCameraCount),
  );
  const activeCameraPage = Math.min(cameraPage, cameraPageCount - 1);
  const visibleMembers = useMemo(() => {
    const pageStart = activeCameraPage * pageableCameraCount;
    const currentPageMembers = pageableMembers.slice(
      pageStart,
      pageStart + pageableCameraCount,
    );

    return selfMember
      ? [selfMember, ...currentPageMembers]
      : currentPageMembers;
  }, [activeCameraPage, pageableCameraCount, pageableMembers, selfMember]);
  const visibleCameraIds = useMemo(
    () =>
      visibleMembers
        .filter((member) => member.id !== myId)
        .map((member) => member.id),
    [myId, visibleMembers],
  );
  const remoteVideoByUser = useMemo(() => {
    const videos = new Map<string, RemoteVideo>();
    remoteVideos.forEach((video) => videos.set(video.userId, video));
    return videos;
  }, [remoteVideos]);

  useEffect(() => {
    setVisibleRemoteUserIds(visibleCameraIds);
  }, [setVisibleRemoteUserIds, visibleCameraIds]);

  useEffect(() => () => setVisibleRemoteUserIds([]), [setVisibleRemoteUserIds]);

  async function handleDeviceChange(deviceId: string) {
    await selectCamera(deviceId);
  }

  async function toggleJoin() {
    if (joined && !window.confirm("작업실에서 퇴장하시겠습니까?")) return;

    if (joined) {
      await leaveSession();
      return;
    }

    await startSession(attendanceSlot ?? undefined);
  }

  async function handleStudyAction() {
    if (studyAction === "BREAK") {
      setBreakConfirmOpen(true);
    } else if (studyAction === "RESUME") {
      await resumeStudy();
    }
  }

  async function confirmStudyBreak() {
    if (studyAction !== "BREAK" || studyActionDisabled) {
      setBreakConfirmOpen(false);
      return;
    }

    await startStudyBreak();
    setBreakConfirmOpen(false);
  }

  function goWaitingRoom() {
    if (
      joined &&
      !window.confirm(
        "작업장을 나가면 교시 중에는 다시 입장하지 못할 수 있습니다. 대기장으로 이동할까요?",
      )
    ) {
      return;
    }
    navigate("/waiting-room");
  }

  return (
    <div className={`sr${cameraOnly ? " is-camera-only" : ""}`}>
      <header className="sr-head">
        <button className="sr-back" onClick={goWaitingRoom}>
          <ArrowBackIcon /> 대기장
        </button>

        <h1 className="sr-title">단체작업장</h1>

        <button className="sr-pill" onClick={() => navigate("/study-line")}>
          <DoorFrontOutlinedIcon />
          개인작업실
          <span>→</span>
        </button>
      </header>

      <main className="sr-body">
        <section className="sr-panel sr-cams">
          <div className="sr-panel-head">
            <div className="sr-panel-title">
              <GroupsOutlinedIcon />
              <span>전국 단체 작업 캠</span>
            </div>

            <div className="sr-panel-actions">
              <button
                className="sr-view-btn"
                onClick={() => setCompactWall((value) => !value)}
                type="button"
                title={compactWall ? "작업 캠 크게 보기" : "작업 캠 많이 보기"}
                aria-label={
                  compactWall ? "작업 캠 크게 보기" : "작업 캠 많이 보기"
                }
              >
                <GridViewOutlinedIcon />
                <span className="sr-view-label">
                  {compactWall ? "크게 보기" : "많이 보기"}
                </span>
                <small>전체 {membersForGrid.length}명</small>
              </button>

              <button
                className="sr-wall-btn"
                onClick={() => setCameraOnly((value) => !value)}
                type="button"
                title={cameraOnly ? "전체 보기" : "캠만 보기"}
                aria-label={cameraOnly ? "전체 보기" : "캠만 보기"}
              >
                <span className="sr-wall-label-full">
                  {cameraOnly ? "전체 보기" : "캠만 보기"}
                </span>
                <span className="sr-wall-label-short">
                  {cameraOnly ? "전체" : "캠"}
                </span>
              </button>

              <button
                className={`sr-sound-btn${scheduleSoundEnabled ? " is-on" : ""}`}
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

              {joined && (
                <button
                  className="sr-quick-leave"
                  onClick={toggleJoin}
                  type="button"
                  disabled={joining}
                >
                  {joining ? "처리 중" : "퇴장"}
                </button>
              )}
            </div>
          </div>

          {!joined ? (
            <WorkroomCameraSetup
              title="작업실 입장 준비"
              description="입장 후에는 큰 셀프 영상 대신 전국 단체 작업 캠에서 함께 확인할 수 있습니다."
              confirmLabel="하루 작업실 입장"
              onConfirm={toggleJoin}
            />
          ) : null}

          {joined && (
            <div
              aria-busy={studyStatusLoading || studyActionPending !== null}
              className={`sr-study-control is-${studyStateTone}`}
            >
              <div
                aria-atomic="true"
                aria-live="polite"
                className="sr-study-copy"
                role="status"
              >
                <i aria-hidden="true" />
                <span>
                  <strong>{studyStateLabel}</strong>
                  <small>{studyStateDescription}</small>
                </span>
              </div>
              <div className="sr-study-actions">
                {studyAction ? (
                  <button
                    className={`sr-study-action is-${studyAction.toLowerCase()}`}
                    disabled={studyActionDisabled}
                    onClick={() => void handleStudyAction()}
                    type="button"
                  >
                    {studyAction === "BREAK" ? (
                      <PauseCircleOutlineRoundedIcon />
                    ) : (
                      <PlayArrowRoundedIcon />
                    )}
                    {studyActionPending
                      ? "변경 중…"
                      : studyStatusLoading
                        ? "확인 중…"
                        : studyAction === "BREAK"
                          ? "기록중지"
                          : isTimetableBreak
                            ? "계속 공부하기"
                            : "공부 재개"}
                  </button>
                ) : isStudyStatusPending && !studyStatusError ? (
                  <button
                    className="sr-study-action is-refresh"
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
            </div>
          )}

          {joined && studyStatusError && (
            <div
              aria-live="assertive"
              className="sr-study-error"
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

          <div className={`sr-grid${compactWall ? " is-compact" : ""}`}>
            {visibleMembers.map((member) => {
              const isMe = member.id === myId;
              const remoteVideo = isMe
                ? undefined
                : remoteVideoByUser.get(member.id);
              const isResting = isMe
                ? cameraPausedForBreak
                : remoteVideo?.muted === true;
              const hasActiveVideo = isMe
                ? joined && !cameraPausedForBreak
                : Boolean(remoteVideo && !remoteVideo.muted);
              const isWorking =
                !isResting &&
                (member.isWorking || (isMe && joined) || hasActiveVideo);
              const todayStudyTime = formatTodayStudyTime(
                member.todayStudy?.studySeconds,
              );
              const memberIndex = Math.max(0, membersForGrid.indexOf(member));
              return (
                <div
                  className={[
                    "sr-cam",
                    isWorking ? "is-working" : "is-waiting",
                    isMe ? "is-me" : "",
                    hasActiveVideo ? "has-video" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={member.id}
                  style={{
                    background:
                      memberIndex % 4 === 0
                        ? "linear-gradient(135deg,#3f5b6e,#273d4d)"
                        : memberIndex % 4 === 1
                          ? "linear-gradient(135deg,#6a8f6f,#4f7a5a)"
                          : memberIndex % 4 === 2
                            ? "linear-gradient(135deg,#7d7aa8,#5d5a88)"
                            : "linear-gradient(135deg,#b08a4f,#8a6a2f)",
                  }}
                >
                  {isMe && joined && !cameraPausedForBreak && (
                    <video
                      ref={attachSelfTileVideo}
                      muted
                      playsInline
                      className="sr-cam-self-video"
                    />
                  )}
                  {remoteVideo && !remoteVideo.muted && (
                    <StudyRoomRemoteVideo track={remoteVideo.track} />
                  )}
                  <span
                    aria-label={`오늘 공부시간 ${todayStudyTime}`}
                    className="sr-cam-today-study"
                    title={`오늘 공부시간 ${todayStudyTime}`}
                  >
                    <small>오늘</small>
                    <strong>{todayStudyTime}</strong>
                  </span>
                  <span className="sr-cam-name">
                    {isMe ? "나" : member.name}
                  </span>
                  <span className={`sr-cam-state${isWorking ? "" : " is-off"}`}>
                    <small>
                      {isResting ? "휴식" : isWorking ? "입장" : "대기"}
                    </small>
                  </span>
                </div>
              );
            })}
            {membersForGrid.length === 0 && (
              <div className="sr-empty-members">
                아직 표시할 작업장 회원이 없습니다.
              </div>
            )}
          </div>

          {cameraPageCount > 1 && (
            <nav className="sr-pagination" aria-label="작업 캠 페이지">
              <button
                type="button"
                className="sr-page-icon"
                onClick={() => setCameraPage(0)}
                disabled={activeCameraPage === 0}
                aria-label="첫 페이지"
              >
                <KeyboardDoubleArrowLeftRoundedIcon />
              </button>
              <button
                type="button"
                className="sr-page-icon"
                onClick={() => setCameraPage(Math.max(0, activeCameraPage - 1))}
                disabled={activeCameraPage === 0}
                aria-label="이전 페이지"
              >
                <KeyboardArrowLeftRoundedIcon />
              </button>
              <span className="sr-page-counter" aria-live="polite">
                {activeCameraPage + 1} / {cameraPageCount}
              </span>
              <button
                type="button"
                className="sr-page-icon"
                onClick={() =>
                  setCameraPage(
                    Math.min(cameraPageCount - 1, activeCameraPage + 1),
                  )
                }
                disabled={activeCameraPage >= cameraPageCount - 1}
                aria-label="다음 페이지"
              >
                <KeyboardArrowRightRoundedIcon />
              </button>
              <button
                type="button"
                className="sr-page-icon"
                onClick={() => setCameraPage(cameraPageCount - 1)}
                disabled={activeCameraPage >= cameraPageCount - 1}
                aria-label="마지막 페이지"
              >
                <KeyboardDoubleArrowRightRoundedIcon />
              </button>
            </nav>
          )}

          {joined && error && <p className="sr-error">{error}</p>}
          {joined && (
            <div className="sr-live-footer">
              <label className="sr-live-device">
                <span>카메라</span>
                <select
                  value={selectedDeviceId}
                  onChange={(event) =>
                    void handleDeviceChange(event.target.value)
                  }
                  disabled={joining || devices.length === 0}
                >
                  {devices.length === 0 && (
                    <option value="">카메라 선택</option>
                  )}
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `카메라 ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className={`sr-live-badge${cameraPausedForBreak ? " is-paused" : ""}`}
              >
                <span className="sr-live-dot" />
                {cameraPausedForBreak ? "카메라 휴식 중" : "캠 송출 중"}
              </div>
              <p>
                카메라 영상은 녹화·저장하지 않으며, 작업장 내 자리 확인을
                위해서만 사용됩니다.
              </p>
            </div>
          )}
          {!cameraOnly && (
            <p className="sr-hint">
              쉬는시간에도 캠과 공부시간 기록이 계속됩니다. 쉴 때는 기록중지를
              눌러주세요.
            </p>
          )}
        </section>

        {!cameraOnly && (
          <section className="sr-bottom-status">
            <div className="sr-status-notice">
              <CampaignOutlinedIcon />
              <span>{bellMsg || current?.isBreak ? "일정" : "공지"}</span>
              <p>{noticeBody}</p>
              <em>실시간</em>
            </div>

            <div className="sr-status-item">
              <span>
                {current?.isBreak
                  ? "현재 휴식"
                  : current
                    ? "현재 교시"
                    : "다음 교시"}
              </span>
              <strong>{current?.label ?? nextSlot?.label ?? "종료"}</strong>
              <p>
                <NotificationsOutlinedIcon /> {periodWindow}
              </p>
            </div>

            <div className="sr-status-item is-time">
              <span>{remainingLabel}</span>
              <strong>{remainingText}</strong>
            </div>

            <div className="sr-status-item is-next">
              <span>다음 교시</span>
              <strong>{nextSlot?.label ?? "종료"}</strong>
              <p>
                <NotificationsOutlinedIcon /> {nextWindow}
              </p>
            </div>
          </section>
        )}
      </main>

      <StudyBreakConfirmDialog
        onCancel={() => setBreakConfirmOpen(false)}
        onConfirm={confirmStudyBreak}
        open={breakConfirmOpen}
        pending={studyActionPending === "BREAK"}
      />

      <footer className="sr-footer">
        <span>자격증공장 재택근무반</span>
      </footer>
    </div>
  );
}
