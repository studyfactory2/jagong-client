import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WorkroomCameraSetup from "../../components/WorkroomCameraSetup";
import AppLoading from "../../components/ui/AppLoading";
import { useSocket } from "../../context/SocketContext";
import { useWorkroomSession } from "../../context/WorkroomSessionContext";
import { getMyStudyRoomEntryAccess } from "../../services/study-room-entry.service";
import { getTimetable } from "../../services/timetable.service";
import {
  resolveStudyRecordingWindow,
  WORKROOM_FALLBACK_TIMETABLE,
} from "../../utils/study-recording-policy";
import type {
  StudyRoomEntryAccess,
  StudyRoomEntryAccessChangedPayload,
  TimetableSlot,
} from "../../../lib/types";
import "./workroom-preparation.css";

type WorkroomMode = "line" | "group";

const WORKROOM_DESTINATIONS: Record<
  WorkroomMode,
  {
    path: string;
    label: string;
    description: string;
  }
> = {
  line: {
    path: "/study-line",
    label: "개인 작업실",
    description: "개인 작업실에 입장하기 전 카메라 화면을 확인해 주세요.",
  },
  group: {
    path: "/study-room",
    label: "단체 작업장",
    description: "단체 작업장에 입장하기 전 카메라 화면을 확인해 주세요.",
  },
};

function parseMode(value: string | null): WorkroomMode | null {
  return value === "line" || value === "group" ? value : null;
}

function accessMessage(access: StudyRoomEntryAccess | null): string {
  switch (access?.reason) {
    case "OPEN_WINDOW":
      return "지금 작업장에 입장할 수 있습니다.";
    case "ADMIN_GRANTED":
      return "관리자 입장 허가가 확인되었습니다.";
    case "ALREADY_IN_ROOM":
      return "현재 교시 작업장에 다시 입장할 수 있습니다.";
    case "STUDY_WINDOW_LOCKED":
      return "교시가 시작되어 관리자 입장 허가가 필요합니다.";
    case "TIMETABLE_UNAVAILABLE":
      return "시간표를 확인할 수 없어 지금은 입장할 수 없습니다.";
    default:
      return "작업장 입장 가능 여부를 확인해 주세요.";
  }
}

function requestError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function WorkroomPreparationContent({ mode }: { mode: WorkroomMode }) {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { cameraReady, joined, joining, startSession, leaveSession } =
    useWorkroomSession();
  const destination = WORKROOM_DESTINATIONS[mode];
  const [access, setAccess] = useState<StudyRoomEntryAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [timetable, setTimetable] = useState<TimetableSlot[]>(
    WORKROOM_FALLBACK_TIMETABLE,
  );
  const [timetableLoaded, setTimetableLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const accessRequestRef = useRef(0);

  const refreshAccess = useCallback(async () => {
    const requestId = accessRequestRef.current + 1;
    accessRequestRef.current = requestId;
    setAccessLoading(true);
    setAccessError("");

    try {
      const nextAccess = await getMyStudyRoomEntryAccess();
      if (accessRequestRef.current !== requestId) return null;
      setAccess(nextAccess);
      return nextAccess;
    } catch (error) {
      if (accessRequestRef.current !== requestId) return null;
      setAccessError(
        requestError(error, "작업장 입장 가능 여부를 확인하지 못했습니다."),
      );
      return null;
    } finally {
      if (accessRequestRef.current === requestId) setAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refreshAccess();
    }, 0);
    return () => {
      window.clearTimeout(initialTimer);
      accessRequestRef.current += 1;
    };
  }, [refreshAccess]);

  useEffect(() => {
    let active = true;
    getTimetable()
      .then((items) => {
        if (!active) return;
        setTimetable(
          [...items].sort((left, right) =>
            left.startTime.localeCompare(right.startTime),
          ),
        );
        setTimetableLoaded(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshAccess();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshAccess]);

  useEffect(() => {
    if (!access?.windowEndsAt) return;
    const windowEnd = Date.parse(access.windowEndsAt);
    const delay = windowEnd - Date.now() + 250;
    if (!Number.isFinite(windowEnd) || delay <= 0) return;

    const timer = window.setTimeout(() => {
      if (cameraReady && !joined && !joining) void leaveSession();
      setAccess(null);
      void refreshAccess();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    access?.windowEndsAt,
    cameraReady,
    joined,
    joining,
    leaveSession,
    refreshAccess,
  ]);

  useEffect(() => {
    if (access?.canEnter !== false || !cameraReady || joined || joining) return;
    const timer = window.setTimeout(() => {
      void leaveSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [access?.canEnter, cameraReady, joined, joining, leaveSession]);

  useEffect(() => {
    if (!socket) return;
    const applyEntryGrant = (payload: StudyRoomEntryAccessChangedPayload) => {
      accessRequestRef.current += 1;
      setAccess(payload);
      setAccessError("");
      setAccessLoading(false);
    };
    const refreshAfterReconnect = () => void refreshAccess();
    socket.on("study-room:entry-access-changed", applyEntryGrant);
    socket.on("connect", refreshAfterReconnect);
    return () => {
      socket.off("study-room:entry-access-changed", applyEntryGrant);
      socket.off("connect", refreshAfterReconnect);
    };
  }, [refreshAccess, socket]);

  useEffect(() => {
    if (joined) navigate(destination.path, { replace: true });
  }, [destination.path, joined, navigate]);

  const recordingWindow = useMemo(
    () => resolveStudyRecordingWindow(timetable, timetableLoaded, now),
    [now, timetable, timetableLoaded],
  );
  const activeAttendanceSlot =
    recordingWindow.current &&
    !recordingWindow.current.isBreak &&
    recordingWindow.current.slot > 0
      ? recordingWindow.current.slot
      : undefined;

  const confirmEntry = async () => {
    if (joining || cancelling || access?.canEnter !== true) return;
    const entered = await startSession(activeAttendanceSlot);
    if (entered) {
      navigate(destination.path, { replace: true });
      return;
    }
    await refreshAccess();
  };

  const returnToWaitingRoom = async () => {
    if (joining || cancelling) return;
    setCancelling(true);
    try {
      await leaveSession();
      navigate("/waiting-room", { replace: true });
    } finally {
      setCancelling(false);
    }
  };

  if (joined) {
    return <AppLoading message={`${destination.label}로 이동하고 있습니다.`} />;
  }

  return (
    <div className="workroom-preparation">
      <header className="workroom-preparation__header">
        <button
          disabled={joining || cancelling}
          onClick={() => void returnToWaitingRoom()}
          type="button"
        >
          <ArrowBackIcon />
          <span>대기장</span>
        </button>
        <div>
          <h1>작업 준비실</h1>
          <p>카메라를 확인한 뒤 작업장에 입장합니다.</p>
        </div>
        <span aria-hidden="true" />
      </header>

      <main className="workroom-preparation__body">
        {accessLoading && !access ? (
          <section
            aria-busy="true"
            className="workroom-preparation__access"
            role="status"
          >
            <span className="workroom-preparation__access-spinner" />
            <div>
              <strong>입장 가능 여부 확인 중</strong>
              <p>현재 교시와 입장 허가를 확인하고 있습니다.</p>
            </div>
          </section>
        ) : accessError && !access ? (
          <section
            className="workroom-preparation__access is-error"
            role="alert"
          >
            <div>
              <strong>입장 상태를 확인하지 못했습니다.</strong>
              <p>{accessError}</p>
            </div>
            <button
              disabled={accessLoading}
              onClick={() => void refreshAccess()}
              type="button"
            >
              <RefreshRoundedIcon />
              다시 확인
            </button>
          </section>
        ) : access?.canEnter !== true ? (
          <section className="workroom-preparation__access is-locked">
            <div>
              <strong>지금은 작업장에 입장할 수 없습니다.</strong>
              <p>{accessMessage(access)}</p>
            </div>
            <button
              disabled={accessLoading}
              onClick={() => void refreshAccess()}
              type="button"
            >
              <RefreshRoundedIcon />
              {accessLoading ? "확인 중" : "다시 확인"}
            </button>
          </section>
        ) : (
          <>
            <div className="workroom-preparation__ready" role="status">
              <span aria-hidden="true" />
              <strong>{accessMessage(access)}</strong>
              <em>
                미리보기 화면은 입장 전까지 다른 사람에게 송출되지 않습니다.
              </em>
            </div>
            <WorkroomCameraSetup
              busyLabel="작업장 연결 중..."
              confirmLabel="오늘도 화이팅! 작업장 입장"
              description={destination.description}
              onConfirm={confirmEntry}
              title="카메라 미리보기"
            />
          </>
        )}
      </main>
    </div>
  );
}

export default function WorkroomPreparation() {
  const [searchParams] = useSearchParams();
  const mode = parseMode(searchParams.get("mode"));
  if (!mode) return <Navigate replace to="/waiting-room" />;
  return <WorkroomPreparationContent mode={mode} />;
}
