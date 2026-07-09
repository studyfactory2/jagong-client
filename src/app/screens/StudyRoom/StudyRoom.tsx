import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import type { Room } from "livekit-client";
import {
  getCamRoomMembers,
  issueCamToken,
  joinCam,
  leaveCam,
  logCamAlert,
  resolveCamAlert,
} from "../../services/cam.service";
import { syncCamAttendance } from "../../services/attendance.service";
import { getTimetable } from "../../services/timetable.service";
import type {
  CamRoomMember,
  CamTokenDto,
  TimetableSlot,
} from "../../../lib/types";
import { useAuth } from "../../context/AuthContext";
import "./study-room.css";

const CAMERA_PAGE_SIZE = 8;

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

const FACE_DETECTOR_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";
const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MISSING_GRACE_MS = 8000;
const ALERT_SEND_INTERVAL_MS = 15000;

type FaceDetectorRuntime = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => { detections?: unknown[] };
  close?: () => void;
};

type SmartAlertState = {
  activeType: string | null;
  missingSince: number | null;
  lastSentAt: number;
  sending: boolean;
  resolving: boolean;
};

const toMin = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

function currentSlot(timetable: TimetableSlot[]): number | null {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const period = timetable.find((slot) => {
    if (slot.isBreak) return false;
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

export default function StudyRoom() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [compactWall, setCompactWall] = useState(true);
  const [cameraOnly, setCameraOnly] = useState(false);
  const [cameraPage, setCameraPage] = useState(0);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [smartStatus, setSmartStatus] = useState<
    "idle" | "checking" | "ok" | "warning" | "unsupported"
  >("idle");
  const [smartMessage, setSmartMessage] =
    useState("입장 후 스마트 출석 확인이 시작됩니다.");
  const [error, setError] = useState("");
  const [camToken, setCamToken] = useState<CamTokenDto | null>(null);
  const [roomMembers, setRoomMembers] = useState<CamRoomMember[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [timetable, setTimetable] =
    useState<TimetableSlot[]>(FALLBACK_TIMETABLE);
  const [now, setNow] = useState(() => new Date());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const selfTileVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const publishedVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const roomRef = useRef<Room | null>(null);
  const faceDetectorRef = useRef<FaceDetectorRuntime | null>(null);
  const smartTimerRef = useRef<number | null>(null);
  const smartAlertRef = useRef<SmartAlertState>({
    activeType: null,
    missingSince: null,
    lastSentAt: 0,
    sending: false,
    resolving: false,
  });
  const joinedRef = useRef(false);
  const joinedSlotRef = useRef<number | null>(null);
  const syncedAttendanceSlotRef = useRef<number | null>(null);
  const myId = session?.user.userId ?? session?.user.id ?? "";
  const myName = session?.user.name ?? "나";

  const refreshRoomMembers = useCallback(async () => {
    try {
      const members = await getCamRoomMembers();
      setRoomMembers(members);
    } catch {
      setRoomMembers([]);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refreshRoomMembers();
    }, 0);
    const timer = window.setInterval(() => void refreshRoomMembers(), 15000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refreshRoomMembers]);

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

  useEffect(() => {
    if (!joined) return;
    const slot = currentSlot(timetable);
    if (!slot || syncedAttendanceSlotRef.current === slot) return;

    syncCamAttendance(slot)
      .then(() => {
        syncedAttendanceSlotRef.current = slot;
      })
      .catch(() => undefined);
  }, [joined, now, timetable]);

  useEffect(() => {
    const element = selfTileVideoRef.current;
    if (!element || !joined) return;
    element.srcObject = streamRef.current;
    void element.play().catch(() => undefined);
  }, [cameraReady, joined, selectedDeviceId]);

  useEffect(() => {
    return () => {
      if (joinedRef.current) {
        void leaveCam();
      }
      stopSmartMonitor();
      roomRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      publishedVideoTrackRef.current = null;
    };
  }, []);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const current = useMemo(
    () =>
      timetable.find(
        (slot) =>
          toMin(slot.startTime) <= nowMin && nowMin < toMin(slot.endTime),
      ),
    [nowMin, timetable],
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
  const noticeBody = current
    ? `${current.label} 집중 체크 중입니다. 화면을 켜고 자리를 유지해 주세요.`
    : nextSlot
      ? `${nextSlot.label} 시작 전입니다. 입장 상태와 카메라를 확인해 주세요.`
      : "오늘 작업장 일정이 종료되었습니다.";
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
  const cameraPageCount = Math.max(
    1,
    Math.ceil(membersForGrid.length / CAMERA_PAGE_SIZE),
  );
  const activeCameraPage = Math.min(cameraPage, cameraPageCount - 1);
  const visibleMembers = useMemo(
    () =>
      membersForGrid.slice(
        activeCameraPage * CAMERA_PAGE_SIZE,
        activeCameraPage * CAMERA_PAGE_SIZE + CAMERA_PAGE_SIZE,
      ),
    [activeCameraPage, membersForGrid],
  );

  function stopLocalCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function ensureFaceDetector(): Promise<FaceDetectorRuntime | null> {
    if (faceDetectorRef.current) return faceDetectorRef.current;

    try {
      const { FaceDetector, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_DETECTOR_MODEL_URL,
        },
        minDetectionConfidence: 0.5,
        runningMode: "VIDEO",
      });
      faceDetectorRef.current = detector as FaceDetectorRuntime;
      return faceDetectorRef.current;
    } catch (err) {
      console.error("MediaPipe face detector failed", err);
      setSmartStatus("unsupported");
      setSmartMessage("스마트 출석 확인을 시작하지 못했습니다.");
      return null;
    }
  }

  function stopSmartMonitor() {
    if (smartTimerRef.current) {
      window.clearInterval(smartTimerRef.current);
      smartTimerRef.current = null;
    }
    faceDetectorRef.current?.close?.();
    faceDetectorRef.current = null;
    smartAlertRef.current = {
      activeType: null,
      missingSince: null,
      lastSentAt: 0,
      sending: false,
      resolving: false,
    };
    setSmartStatus("idle");
    setSmartMessage("입장 후 스마트 출석 확인이 시작됩니다.");
  }

  async function sendSmartAlert(alertType: string, duration: number) {
    const state = smartAlertRef.current;
    const nowMs = Date.now();
    if (
      state.sending ||
      (state.activeType === alertType &&
        nowMs - state.lastSentAt < ALERT_SEND_INTERVAL_MS)
    ) {
      return;
    }

    state.sending = true;
    state.activeType = alertType;
    state.lastSentAt = nowMs;
    try {
      await logCamAlert({
        slot: currentSlot(timetable) ?? joinedSlotRef.current ?? undefined,
        alertType,
        duration,
      });
    } catch (err) {
      console.error("Smart attendance alert failed", err);
    } finally {
      state.sending = false;
    }
  }

  async function resolveSmartAlert() {
    const state = smartAlertRef.current;
    if (!state.activeType || state.resolving) return;

    const alertType = state.activeType;
    state.resolving = true;
    try {
      await resolveCamAlert({ alertType });
      state.activeType = null;
      state.missingSince = null;
      setSmartStatus("ok");
      setSmartMessage("화면 상태가 정상입니다.");
    } catch (err) {
      console.error("Smart attendance resolve failed", err);
    } finally {
      state.resolving = false;
    }
  }

  async function evaluateSmartAttendance(detector: FaceDetectorRuntime) {
    if (!joinedRef.current) return;

    const video = selfTileVideoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    const trackLive =
      track &&
      track.readyState === "live" &&
      track.enabled &&
      !track.muted;

    if (!video || !trackLive) {
      setSmartStatus("warning");
      setSmartMessage("카메라 송출 상태를 확인해 주세요.");
      await sendSmartAlert("CAMERA_OFF", 0);
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setSmartStatus("checking");
      setSmartMessage("카메라 화면을 확인하는 중입니다.");
      return;
    }

    try {
      const result = detector.detectForVideo(video, performance.now());
      const faceCount = result.detections?.length ?? 0;
      const state = smartAlertRef.current;

      if (faceCount > 0) {
        state.missingSince = null;
        if (state.activeType) {
          await resolveSmartAlert();
        } else {
          setSmartStatus("ok");
          setSmartMessage("화면 상태가 정상입니다.");
        }
        return;
      }

      const nowMs = Date.now();
      state.missingSince ??= nowMs;
      const missingMs = nowMs - state.missingSince;

      setSmartStatus("warning");
      setSmartMessage(
        missingMs >= FACE_MISSING_GRACE_MS
          ? "화면에 얼굴이 보이지 않습니다."
          : "얼굴 위치를 확인하는 중입니다.",
      );

      if (missingMs >= FACE_MISSING_GRACE_MS) {
        await sendSmartAlert("FACE_MISSING", Math.floor(missingMs / 1000));
      }
    } catch (err) {
      console.error("Smart attendance detection failed", err);
      setSmartStatus("unsupported");
      setSmartMessage("스마트 출석 확인 중 오류가 발생했습니다.");
    }
  }

  async function startSmartMonitor() {
    if (smartTimerRef.current) return;

    const detector = await ensureFaceDetector();
    if (!detector) return;

    setSmartStatus("checking");
    setSmartMessage("스마트 출석 확인을 시작합니다.");
    smartTimerRef.current = window.setInterval(() => {
      void evaluateSmartAttendance(detector);
    }, 1600);
    void evaluateSmartAttendance(detector);
  }

  function disconnectLiveKit() {
    roomRef.current?.disconnect();
    roomRef.current = null;
    publishedVideoTrackRef.current = null;
  }

  async function unpublishCameraTrack() {
    const room = roomRef.current;
    const publishedTrack = publishedVideoTrackRef.current;
    if (!room || !publishedTrack) {
      publishedVideoTrackRef.current = null;
      return;
    }

    await room.localParticipant.unpublishTrack(publishedTrack);
    publishedVideoTrackRef.current = null;
  }

  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const cameras = allDevices.filter((device) => device.kind === "videoinput");
    setDevices(cameras);
    if (!selectedDeviceId && cameras[0]?.deviceId) {
      setSelectedDeviceId(cameras[0].deviceId);
    }
  }

  async function startLocalCamera(deviceId?: string) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저에서는 카메라를 사용할 수 없습니다.");
    }

    stopLocalCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false,
    });

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
    }
    setCameraReady(true);
    await refreshDevices();
  }

  async function republishCameraTrack(token = camToken) {
    const room = roomRef.current;
    const newTrack = streamRef.current?.getVideoTracks()[0];
    if (!room || !token?.canPublish || !newTrack) return;

    const { Track } = await import("livekit-client");
    await unpublishCameraTrack();
    await room.localParticipant.publishTrack(newTrack, {
      source: Track.Source.Camera,
    });
    publishedVideoTrackRef.current = newTrack;
  }

  async function connectLiveKit(token: CamTokenDto) {
    if (!token.url || token.token.startsWith("stub.")) return;

    const { Room, Track } = await import("livekit-client");
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    try {
      await room.connect(token.url, token.token);
      roomRef.current = room;

      if (token.canPublish) {
        const videoTrack = streamRef.current?.getVideoTracks()[0];
        if (videoTrack) {
          await room.localParticipant.publishTrack(videoTrack, {
            source: Track.Source.Camera,
          });
          publishedVideoTrackRef.current = videoTrack;
        }
      }
    } catch (err) {
      room.disconnect();
      throw err;
    }
  }

  async function handleDeviceChange(deviceId: string) {
    setSelectedDeviceId(deviceId);
    setError("");
    try {
      if (joined) {
        await unpublishCameraTrack();
      }
      await startLocalCamera(deviceId || undefined);
      if (joined) {
        await republishCameraTrack();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카메라를 변경하지 못했습니다.",
      );
    }
  }

  async function handlePreviewCamera() {
    setError("");
    setJoining(true);
    try {
      await startLocalCamera(selectedDeviceId || undefined);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "카메라 미리보기를 시작하지 못했습니다.",
      );
    } finally {
      setJoining(false);
    }
  }

  async function toggleJoin() {
    if (joined && !window.confirm("작업실에서 퇴장하시겠습니까?")) return;

    setError("");
    setJoining(true);
    try {
      if (joined) {
        stopSmartMonitor();
        await leaveCam();
        disconnectLiveKit();
        stopLocalCamera();
        joinedRef.current = false;
        joinedSlotRef.current = null;
        syncedAttendanceSlotRef.current = null;
        setJoined(false);
        setCamToken(null);
        await refreshRoomMembers();
      } else {
        const slot = currentSlot(timetable);
        const token = await issueCamToken();
        await startLocalCamera(selectedDeviceId || undefined);
        await connectLiveKit(token);
        await joinCam(slot ?? undefined);
        joinedRef.current = true;
        joinedSlotRef.current = slot;
        syncedAttendanceSlotRef.current = slot;
        setCamToken(token);
        setJoined(true);
        void startSmartMonitor();
        await refreshRoomMembers();
      }
    } catch (err) {
      stopSmartMonitor();
      disconnectLiveKit();
      stopLocalCamera();
      joinedRef.current = false;
      joinedSlotRef.current = null;
      syncedAttendanceSlotRef.current = null;
      setError(
        err instanceof Error
          ? err.message
          : "작업장 입장 상태를 변경하지 못했습니다.",
      );
    } finally {
      setJoining(false);
    }
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

            <button
              className="sr-view-btn"
              onClick={() => setCompactWall((value) => !value)}
              type="button"
            >
              <GridViewOutlinedIcon />
              {compactWall ? "크게 보기" : "많이 보기"}
              <small>전체 {membersForGrid.length}명</small>
            </button>

            <button
              className="sr-wall-btn"
              onClick={() => setCameraOnly((value) => !value)}
              type="button"
            >
              {cameraOnly ? "전체 보기" : "캠만 보기"}
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

          {!joined ? (
            <div className="sr-setup">
              <div className="sr-setup-video">
                <video ref={videoRef} muted playsInline />
                {!cameraReady && (
                  <span>
                    <DoorFrontOutlinedIcon />
                    카메라 각도와 기기를 먼저 확인해 주세요.
                  </span>
                )}
              </div>

              <div className="sr-setup-info">
                <strong>작업실 입장 준비</strong>
                <em>
                  입장 후에는 학생 화면에 큰 셀프 영상이 보이지 않고, 관리자에게
                  캠만 송출됩니다.
                </em>

                <label>
                  <span>카메라 선택</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(event) =>
                      void handleDeviceChange(event.target.value)
                    }
                    disabled={joining || devices.length === 0}
                  >
                    {devices.length === 0 && (
                      <option value="">미리보기 후 선택 가능</option>
                    )}
                    {devices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `카메라 ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="sr-setup-actions">
                  <button
                    className="sr-preview-btn"
                    type="button"
                    onClick={handlePreviewCamera}
                    disabled={joining}
                  >
                    카메라 미리보기
                  </button>
                  <button
                    className="sr-join"
                    onClick={toggleJoin}
                    type="button"
                    disabled={joining}
                  >
                    {joining ? "카메라 확인 중..." : "하루 작업실 입장"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className={`sr-grid${compactWall ? " is-compact" : ""}`}>
            {visibleMembers.map((member, index) => {
              const isMe = member.id === myId;
              const isWorking = member.isWorking || (isMe && joined);
              const memberIndex = activeCameraPage * CAMERA_PAGE_SIZE + index;
              return (
                <div
                  className={[
                    "sr-cam",
                    isWorking ? "is-working" : "is-waiting",
                    isMe ? "is-me" : "",
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
                  {isMe && joined && (
                    <video
                      ref={selfTileVideoRef}
                      muted
                      playsInline
                      className="sr-cam-self-video"
                    />
                  )}
                  <span className="sr-cam-name">
                    {isMe ? "나" : member.name}
                  </span>
                  <span className={`sr-cam-state${isWorking ? "" : " is-off"}`}>
                    <small>{isWorking ? "입장" : "대기"}</small>
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

          {error && <p className="sr-error">{error}</p>}
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
              <div className="sr-live-badge">
                <span className="sr-live-dot" />캠 송출 중
              </div>
              <div className={`sr-smart-badge is-${smartStatus}`}>
                <span />
                {smartMessage}
              </div>
              <p>
                카메라 영상은 녹화·저장하지 않으며, 작업장 내 자리 확인을
                위해서만 사용됩니다.
              </p>
            </div>
          )}
          {!cameraOnly && (
            <p className="sr-hint">
              입장 후에는 교시가 바뀌어도 캠이 유지됩니다. 쉬는시간에는 원하면
              직접 퇴장할 수 있습니다.
            </p>
          )}
        </section>

        {!cameraOnly && (
          <section className="sr-bottom-status">
            <div className="sr-status-notice">
              <CampaignOutlinedIcon />
              <span>공지</span>
              <p>{noticeBody}</p>
              <em>실시간</em>
            </div>

            <div className="sr-status-item">
              <span>{current ? "현재 교시" : "다음 교시"}</span>
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

      <footer className="sr-footer">
        <span>자격증공장 재택근무반</span>
        <nav>
          <button type="button" onClick={goWaitingRoom}>
            대기장
          </button>
          <button type="button" onClick={() => navigate("/study-line")}>
            개인작업실
          </button>
        </nav>
      </footer>
    </div>
  );
}
