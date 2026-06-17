import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import MicNoneIcon from "@mui/icons-material/MicNone";
import MicOffIcon from "@mui/icons-material/MicOff";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import type { Room } from "livekit-client";
import { issueCamToken, joinCam, leaveCam } from "../../services/cam.service";
import { getTimetable } from "../../services/timetable.service";
import type { CamTokenDto, TimetableSlot } from "../../../lib/types";
import "./study-room.css";

const WORKERS = [
  "오늘도합격",
  "정리왕",
  "해피스터디",
  "공부는내일",
  "꾸준히가자",
  "합격기원",
  "포기하지마",
  "노력은배신X",
  "내일은합격",
  "자격증러버",
  "끝까지한다",
  "로스팅중",
  "매일출근",
  "고득점가자",
  "기초튼튼",
  "집중모드",
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
  const [visibleCount, setVisibleCount] = useState(16);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [camToken, setCamToken] = useState<CamTokenDto | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [timetable, setTimetable] =
    useState<TimetableSlot[]>(FALLBACK_TIMETABLE);
  const [now, setNow] = useState(() => new Date());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const publishedVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const roomRef = useRef<Room | null>(null);
  const joinedRef = useRef(false);
  const joinedSlotRef = useRef<number | null>(null);

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

  function stopLocalCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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
    if (!joined) return;
    setError("");
    try {
      await startLocalCamera(deviceId || undefined);
      await republishCameraTrack();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카메라를 변경하지 못했습니다.",
      );
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

          <div className={"sr-self" + (joined ? " is-on" : "")}>
            <div className="sr-self-video">
              <video ref={videoRef} muted playsInline />
              {!joined && (
                <span>
                  <DoorFrontOutlinedIcon />
                  하루 작업실에 입장하면 내 카메라가 계속 표시됩니다.
                </span>
              )}
            </div>
            <div className="sr-self-info">
              <strong>
                {joined
                  ? "하루 작업실 캠 송출 중"
                  : "작업실 입장 전 카메라 확인"}
              </strong>
              <em>
                {camToken
                  ? `작업방 ${camToken.room.slice(0, 8)} · ${camToken.canPublish ? "송출 가능" : "보기 전용"}`
                  : "카메라 권한을 허용한 뒤 작업장에 입장합니다."}
              </em>
              <label>
                <span>카메라 선택</span>
                <select
                  value={selectedDeviceId}
                  onChange={(event) =>
                    void handleDeviceChange(event.target.value)
                  }
                  disabled={!joined || joining || devices.length === 0}
                >
                  {devices.length === 0 && (
                    <option value="">입장 후 선택 가능</option>
                  )}
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `카메라 ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="sr-grid">
            {WORKERS.slice(0, visibleCount).map((name, index) => {
              const micOn = index % 3 !== 2;
              return (
                <div
                  className="sr-cam"
                  key={`${name}-${index}`}
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
                  <img
                    src={`/preview/${(index % 8) + 1}.jpg`}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="sr-cam-name">{name}</span>
                  <span className={`sr-cam-state${micOn ? "" : " is-off"}`}>
                    {micOn ? <MicNoneIcon /> : <MicOffIcon />}
                  </span>
                </div>
              );
            })}
          </div>

          {error && <p className="sr-error">{error}</p>}
          <button
            className="sr-join"
            onClick={toggleJoin}
            type="button"
            disabled={joining}
          >
            {joining
              ? "카메라 확인 중..."
              : joined
                ? "하루 작업실 퇴장"
                : "하루 작업실 입장"}
          </button>
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
