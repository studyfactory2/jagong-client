import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import {
  formatTodayStudyTime,
  useTodayStudyTimer,
} from "../../hooks/useTodayStudyTimer";
import { getTimetable } from "../../services/timetable.service";
import type { TimetableSlot, WorkroomMode } from "../../../lib/types";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import {
  useWorkroomSession,
  type RemoteVideo,
  type RemoteVideoTrack,
} from "../../context/WorkroomSessionContext";
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
import { observeAdaptiveCameraFit } from "../../utils/adaptive-camera-fit";
import "./study-room.css";

const getCameraPageSize = () => {
  if (typeof window === "undefined") return 8;
  if (window.innerWidth >= 1200) return 20;
  if (window.innerWidth >= 560) return 12;
  return 8;
};

const toMin = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

function isClockInSlot(slot: TimetableSlot) {
  return slot.slot === 0 || slot.label.includes("출근");
}

function isAttendanceSlot(slot: TimetableSlot) {
  return !slot.isBreak && !isClockInSlot(slot);
}

function timeLeftText(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours <= 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function StudyRoomRemoteVideo({
  track,
  workroomMode,
}: {
  track: RemoteVideoTrack;
  workroomMode: WorkroomMode;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return undefined;

    track.attach(element);
    const stopObservingCameraFit = observeAdaptiveCameraFit(element);
    void element.play().catch(() => undefined);

    return () => {
      stopObservingCameraFit();
      track.detach(element);
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`sr-cam-remote-video${
        workroomMode === "line" ? " is-line-blurred" : ""
      }`}
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
    workroomModeSwitching,
    workroomModeError,
    cameraPausedForBreak,
    error,
    localVideoTrack,
    roomMembers,
    remoteVideos,
    studyStatus,
    studyStatusLoading,
    studyStatusError,
    studyActionPending,
    leaveSession,
    syncAttendanceSlot,
    refreshStudyStatus,
    startStudyBreak,
    resumeStudy,
    setVisibleRemoteUserIds,
    switchWorkroomMode,
  } = useWorkroomSession();
  const [cameraPage, setCameraPage] = useState(0);
  const [cameraPageSize, setCameraPageSize] = useState(getCameraPageSize);
  const [timetable, setTimetable] = useState<TimetableSlot[]>(
    WORKROOM_FALLBACK_TIMETABLE,
  );
  const [timetableLoaded, setTimetableLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const selfTileVideoRef = useRef<HTMLVideoElement | null>(null);
  const selfTileFitCleanupRef = useRef<(() => void) | null>(null);
  const myId = session?.user.userId ?? session?.user.id ?? "";
  const myName = session?.user.name ?? "나";
  const myExamType = session?.user.examType?.trim() || null;

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
    if (!socket) return;

    const onBell = (data: ScheduleBellEvent) => {
      if (getWorkdayAnnouncement(data)) return;
      const message = scheduleBellMessage(data);
      if (!message) return;
      if (getScheduleSoundEnabled()) playScheduleTone(data.type);
    };

    socket.on("bell", onBell);

    return () => {
      socket.off("bell", onBell);
    };
  }, [socket]);

  useEffect(() => {
    getTimetable()
      .then((items) => {
        setTimetableLoaded(true);
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

  const recordingWindow = useMemo(
    () => resolveStudyRecordingWindow(timetable, timetableLoaded, now),
    [now, timetable, timetableLoaded],
  );
  const { current } = recordingWindow;
  const nowMin = Math.floor(recordingWindow.seoulSeconds / 60);
  const attendanceSlot =
    current && isAttendanceSlot(current) ? current.slot : null;

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
      selfTileFitCleanupRef.current?.();
      selfTileFitCleanupRef.current = null;

      selfTileVideoRef.current = element;
      if (!element || !joined || cameraPausedForBreak || !localVideoTrack) {
        return;
      }

      localVideoTrack.attach(element);
      selfTileFitCleanupRef.current = observeAdaptiveCameraFit(element);
      void element.play().catch(() => undefined);
    },
    [cameraPausedForBreak, joined, localVideoTrack],
  );

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
  const isStudyStatusPending = !(
    studyStatus?.active &&
    studyStatus.state &&
    studyStatus.source
  );
  const currentStudyState = createStudyRecordingView({
    cameraPausedForBreak,
    loading: studyStatusLoading,
    status: studyStatus,
    window: recordingWindow,
  });
  const studyAction = currentStudyState.action;
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
  const { refreshAfterStudyTransition, todayStudyTime } = useTodayStudyTimer({
    cameraPausedForBreak,
    joined,
    now,
    refreshStudyStatus,
    studyStatus,
    studyStatusError,
    studyStatusLoading,
  });
  const membersForGrid = useMemo(() => {
    const withSelfStatus = roomMembers.map((member) =>
      member.id === myId
        ? {
            ...member,
            examType:
              member.examType === undefined ? myExamType : member.examType,
            isWorking: joined || member.isWorking,
          }
        : member,
    );

    if (myId && !withSelfStatus.some((member) => member.id === myId)) {
      withSelfStatus.unshift({
        id: myId,
        name: myName,
        examType: myExamType,
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
  }, [joined, myExamType, myId, myName, roomMembers]);
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

  async function goPreparationRoom() {
    if (
      !window.confirm(
        "카메라 송출과 공부시간 기록을 종료하고 작업 준비실로 이동할까요?",
      )
    ) {
      return;
    }
    await leaveSession();
    navigate("/workroom/prepare?mode=group", { replace: true });
  }

  async function handleStudyAction() {
    if (studyAction === "BREAK") {
      if (await startStudyBreak()) refreshAfterStudyTransition();
    } else if (studyAction === "RESUME") {
      if (await resumeStudy()) refreshAfterStudyTransition();
    }
  }

  async function goWaitingRoom() {
    if (
      joined &&
      !window.confirm(
        "작업장을 나가면 교시 중에는 다시 입장하지 못할 수 있습니다. 대기장으로 이동할까요?",
      )
    ) {
      return;
    }
    await leaveSession();
    navigate("/waiting-room");
  }

  async function goPrivateWorkroom() {
    if (joining || workroomModeSwitching) return;
    if (await switchWorkroomMode("line")) navigate("/study-line");
  }

  return (
    <div className="sr">
      <header className="sr-head">
        <button
          className="sr-back"
          disabled={joining}
          onClick={() => void goWaitingRoom()}
          type="button"
        >
          <ArrowBackIcon /> 대기장
        </button>

        <h1 className="sr-title">단체작업장</h1>

        <div className="sr-head-actions">
          <button
            className="sr-prepare-link"
            disabled={joining}
            onClick={() => void goPreparationRoom()}
            type="button"
          >
            <span className="sr-nav-label-full">
              {joining ? "이동 중…" : "작업 준비실"}
            </span>
            <span className="sr-nav-label-short">
              {joining ? "이동 중" : "준비실"}
            </span>
          </button>
          <button
            className="sr-pill"
            disabled={joining || workroomModeSwitching}
            onClick={() => void goPrivateWorkroom()}
            type="button"
          >
            <DoorFrontOutlinedIcon />
            <span className="sr-nav-label-full">
              {workroomModeSwitching ? "전환 중…" : "개인작업실"}
            </span>
            <span className="sr-nav-label-short">
              {workroomModeSwitching ? "전환 중" : "개인실"}
            </span>
          </button>
        </div>
      </header>

      <main className="sr-body">
        <section
          aria-busy={studyStatusLoading || studyActionPending !== null}
          className={`sr-session-bar is-${compactStudyTone}`}
        >
          <div
            aria-label={`${compactStudyLabel}. ${compactStudyDetail}`}
            aria-live="polite"
            className="sr-session-state"
            role="status"
          >
            <i aria-hidden="true" />
            <strong>{compactStudyLabel}</strong>
          </div>
          <div
            aria-label={`오늘 누적 공부시간 ${todayStudyTime}`}
            className="sr-session-timer"
            role="timer"
          >
            <small>오늘 공부시간</small>
            <strong aria-hidden="true">{todayStudyTime}</strong>
          </div>
          <div className="sr-session-action-slot">
            {joined && studyAction ? (
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
                    : currentStudyState.actionLabel}
              </button>
            ) : joined && isStudyStatusPending && !studyStatusError ? (
              <button
                className="sr-study-action is-refresh"
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

        <section className="sr-panel sr-cams">
          <div className="sr-grid">
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
              const isPrivateRemoteVideo = Boolean(
                !isMe &&
                  hasActiveVideo &&
                  remoteVideo?.workroomMode === "line",
              );
              const cameraStateLabel = isResting
                ? "휴식"
                : !isWorking
                  ? "대기"
                  : isPrivateRemoteVideo
                    ? "개인"
                    : "입장";
              const memberTodayStudyTime = formatTodayStudyTime(
                member.todayStudy?.studySeconds,
              );
              const memberExamType = member.examType?.trim();
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
                    <StudyRoomRemoteVideo
                      track={remoteVideo.track}
                      workroomMode={remoteVideo.workroomMode}
                    />
                  )}
                  <div className="sr-cam-top-meta">
                    <span
                      className={`sr-cam-state${isWorking ? "" : " is-off"}`}
                    >
                      <small>{cameraStateLabel}</small>
                    </span>
                    <span
                      aria-label={`오늘 공부시간 ${memberTodayStudyTime}`}
                      className="sr-cam-today-study"
                      title={`오늘 공부시간 ${memberTodayStudyTime}`}
                    >
                      <small>오늘</small>
                      <strong>{memberTodayStudyTime}</strong>
                    </span>
                  </div>
                  <div className="sr-cam-bottom-meta">
                    <span className="sr-cam-name">
                      {isMe ? "나" : member.name}
                    </span>
                    {memberExamType && (
                      <span
                        aria-label={`준비 시험 ${memberExamType}`}
                        className="sr-cam-exam"
                        title={`준비 시험: ${memberExamType}`}
                      >
                        {memberExamType}
                      </span>
                    )}
                  </div>
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
                className="sr-page-icon is-edge"
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
                className="sr-page-icon is-edge"
                onClick={() => setCameraPage(cameraPageCount - 1)}
                disabled={activeCameraPage >= cameraPageCount - 1}
                aria-label="마지막 페이지"
              >
                <KeyboardDoubleArrowRightRoundedIcon />
              </button>
            </nav>
          )}

          {joined && (workroomModeError || error) && (
            <p className="sr-error">{workroomModeError || error}</p>
          )}
        </section>

        <section className="sr-bottom-status">
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
      </main>

      <footer className="sr-footer">
        <span>자격증공장 재택근무반</span>
      </footer>
    </div>
  );
}
