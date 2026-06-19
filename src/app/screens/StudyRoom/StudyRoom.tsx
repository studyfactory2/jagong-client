import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import type { Room } from "livekit-client";
import {
  getCamRoomMembers,
  issueCamToken,
  joinCam,
  leaveCam,
} from "../../services/cam.service";
import { getTimetable } from "../../services/timetable.service";
import type { CamRoomMember, CamTokenDto, TimetableSlot } from "../../../lib/types";
import { useAuth } from "../../context/AuthContext";
import "./study-room.css";

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

function currentSlot(timetable: TimetableSlot[]): number | null {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const period = timetable.find((slot) => {
    if (slot.isBreak) return false;
    return toMin(slot.startTime) <= nowMin && nowMin < toMin(slot.endTime);
  });
  return period?.slot ?? null;
}

export default function StudyRoom() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [visibleCount, setVisibleCount] = useState(16);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
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
  const joinedRef = useRef(false);
  const joinedSlotRef = useRef<number | null>(null);
  const myId = session?.user.userId ?? session?.user.id ?? "";

  const refreshRoomMembers = useCallback(async () => {
    try {
      const members = await getCamRoomMembers();
      setRoomMembers(members);
    } catch {
      setRoomMembers([]);
    }
  }, []);

  useEffect(() => {
    void refreshRoomMembers();
    const timer = window.setInterval(() => void refreshRoomMembers(), 15000);
    return () => window.clearInterval(timer);
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
  const completedSlots = timetable.filter(
    (slot) => toMin(slot.endTime) <= nowMin,
  ).length;
  const progress = Math.min(
    100,
    Math.round((completedSlots / Math.max(1, timetable.length)) * 100),
  );
  const membersForGrid = useMemo(() => {
    const withSelfStatus = roomMembers.map((member) =>
      member.id === myId ? { ...member, isWorking: joined || member.isWorking } : member,
    );

    if (myId && !withSelfStatus.some((member) => member.id === myId)) {
      withSelfStatus.unshift({
        id: myId,
        name: session?.user.name ?? "나",
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
  }, [joined, myId, roomMembers, session?.user.name]);

  function stopLocalCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function disconnectLiveKit() {
    roomRef.current?.disconnect();
    roomRef.current = null;
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
    if (publishedVideoTrackRef.current) {
      await room.localParticipant.unpublishTrack(
        publishedVideoTrackRef.current,
      );
    }

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
  }

  async function handleDeviceChange(deviceId: string) {
    setSelectedDeviceId(deviceId);
    setError("");
    try {
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
        err instanceof Error ? err.message : "카메라 미리보기를 시작하지 못했습니다.",
      );
    } finally {
      setJoining(false);
    }
  }

  async function toggleJoin() {
    setError("");
    setJoining(true);
    try {
      if (joined) {
        await leaveCam();
        disconnectLiveKit();
        stopLocalCamera();
        joinedRef.current = false;
        joinedSlotRef.current = null;
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
        setCamToken(token);
        setJoined(true);
        await refreshRoomMembers();
      }
    } catch (err) {
      disconnectLiveKit();
      stopLocalCamera();
      joinedRef.current = false;
      joinedSlotRef.current = null;
      setError(
        err instanceof Error
          ? err.message
          : "작업장 입장 상태를 변경하지 못했습니다.",
      );
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="sr">
      <header className="sr-head">
        <button className="sr-back" onClick={() => navigate("/waiting-room")}>
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
              onClick={() =>
                setVisibleCount((n) => (n === 8 ? 16 : n === 16 ? 25 : 8))
              }
            >
              <GridViewOutlinedIcon />
              {visibleCount}개 보기
              <small>8 → 16 → 25</small>
            </button>
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
          ) : (
            <div className="sr-live-status">
              <div className="sr-live-badge">
                <span className="sr-live-dot" />
                캠 송출 중
              </div>
              <div className="sr-live-meta">
                <strong>하루 작업실에 입장했습니다.</strong>
                <em>
                  학생 화면에는 큰 셀프 영상이 뜨지 않습니다. 관리자는 작업장
                  모니터에서 현재 캠을 확인합니다.
                </em>
              </div>
              <label className="sr-live-device">
                <span>카메라</span>
                <select
                  value={selectedDeviceId}
                  onChange={(event) =>
                    void handleDeviceChange(event.target.value)
                  }
                  disabled={joining || devices.length === 0}
                >
                  {devices.length === 0 && <option value="">카메라 선택</option>}
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `카메라 ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="sr-grid">
            {membersForGrid.slice(0, visibleCount).map((member, index) => {
              const isMe = member.id === myId;
              const isWorking = member.isWorking || (isMe && joined);
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
                      index % 4 === 0
                        ? "linear-gradient(135deg,#3f5b6e,#273d4d)"
                        : index % 4 === 1
                          ? "linear-gradient(135deg,#6a8f6f,#4f7a5a)"
                          : index % 4 === 2
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

          {error && <p className="sr-error">{error}</p>}
          {joined && (
            <button
              className="sr-join is-leave"
              onClick={toggleJoin}
              type="button"
              disabled={joining}
            >
              {joining ? "퇴장 처리 중..." : "하루 작업실 퇴장"}
            </button>
          )}
          <p className="sr-hint">
            입장 후에는 교시가 바뀌어도 캠이 유지됩니다. 쉬는시간에는 원하면
            직접 퇴장할 수 있습니다.
          </p>
        </section>

        <section className="sr-notice">
          <span>공지창</span>
          관리자 공지: {current?.label ?? nextSlot?.label ?? "오늘 일정"} 집중
          체크 중입니다. 화면을 켜고 자리를 유지해 주세요.
          <em>실시간</em>
        </section>

        <section className="sr-panel sr-progress">
          <div className="sr-panel-head">
            <div className="sr-panel-title">
              <CampaignOutlinedIcon />
              <span>오늘 진행률 · 교시 안내</span>
            </div>
            <button className="sr-check">접기 ▲</button>
          </div>

          <div className="sr-progress-grid">
            <div className="sr-progress-box">
              <span>오늘 진행률</span>
              <strong>{progress}%</strong>
              <em>
                ({completedSlots}/{timetable.length})
              </em>
              <div className="sr-bar">
                <i style={{ width: `${progress}%` }} />
              </div>
              <p>오늘도 차근차근 진행 중!</p>
            </div>

            <div className="sr-period is-now">
              <span>현재 진행중</span>
              <strong>{current?.label ?? "대기중"}</strong>
              <p>
                <NotificationsOutlinedIcon />{" "}
                {current
                  ? `${current.startTime} - ${current.endTime}`
                  : "다음 교시 전입니다"}
              </p>
            </div>

            <div className="sr-period is-next">
              <span>다음 교시</span>
              <strong>{nextSlot?.label ?? "종료"}</strong>
              <p>
                <NotificationsOutlinedIcon />{" "}
                {nextSlot
                  ? `${nextSlot.startTime} - ${nextSlot.endTime}`
                  : "오늘 일정이 종료되었습니다"}
              </p>
            </div>
          </div>
        </section>

        <div className="sr-dots">
          <i className="is-active" />
          <i />
          <i />
          <i />
          <i />
        </div>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
