import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NavigateBeforeOutlinedIcon from "@mui/icons-material/NavigateBeforeOutlined";
import NavigateNextOutlinedIcon from "@mui/icons-material/NavigateNextOutlined";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import type { Room } from "livekit-client";
import type {
  AdminUser,
  CamSessionRecord,
  TimetableSlot,
} from "../../../lib/types";
import { issueCamToken } from "../../services/cam.service";
import { dDayText, dateText, userDetail } from "./admin.utils";

type CameraProps = {
  camSessions: CamSessionRecord[];
  timetable: TimetableSlot[];
  users: AdminUser[];
  searchText: string;
  onSearchChange: (value: string) => void;
  onWarn: (userId: string, message: string, type?: string) => Promise<void>;
};

type CameraTile = {
  id: string;
  name: string;
  status: "working" | "waiting";
  age?: number | null;
  membershipEnd?: string | null;
  slot?: number;
  joinedAt?: string | null;
};

type RemoteVideoTrack = {
  attach: (element?: HTMLMediaElement) => HTMLMediaElement;
  detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
};

type RemoteVideo = {
  trackSid: string;
  userId: string;
  track: RemoteVideoTrack;
};

const PAGE_SIZE = 12;
const WARNING_PRESETS = [
  { type: "SLEEP", label: "졸음", message: "졸지 말고 다시 집중해주세요." },
  {
    type: "POSTURE",
    label: "자세",
    message: "자세를 바로 하고 화면에 집중해주세요.",
  },
  { type: "CAMERA", label: "카메라", message: "카메라 상태를 확인해주세요." },
  {
    type: "AWAY",
    label: "자리",
    message: "자리비움이 감지되었습니다. 자리로 돌아와 주세요.",
  },
];

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function currentSlot(slots: TimetableSlot[]) {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  return slots.find((slot) => {
    const start = minutes(slot.startTime);
    const end = minutes(slot.endTime);
    if (start === null || end === null) return false;
    return current >= start && current < end;
  });
}

function LiveVideo({ track }: { track: RemoteVideoTrack }) {
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
      className="admin-camera-stream"
    />
  );
}

export default function Camera({
  camSessions,
  timetable,
  users,
  searchText,
  onSearchChange,
  onWarn,
}: CameraProps) {
  /** STATE **/
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const [liveStatus, setLiveStatus] = useState<
    "connecting" | "connected" | "stub" | "error"
  >("connecting");
  const [liveError, setLiveError] = useState("");
  const roomRef = useRef<Room | null>(null);
  const visibleIdsRef = useRef<string[]>([]);

  /** DERIVED **/
  const activeSlot = useMemo(() => currentSlot(timetable), [timetable]);
  const isStudyTime = Boolean(activeSlot && !activeSlot.isBreak);

  const tiles = useMemo<CameraTile[]>(() => {
    const liveByUser = new Map(
      camSessions
        .filter((session) => !session.leftAt)
        .map((session) => [session.userId, session]),
    );

    const query = searchText.trim().toLowerCase();
    const members = users.filter((user) => {
      if (user.role !== "MEMBER") return false;
      if (!query) return true;
      return [user.name, user.phone, user.examType, user.residenceArea]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
    return members.map((user) => {
      const live = liveByUser.get(user.id);
      return {
        id: user.id,
        name: user.name,
        status: live ? "working" : "waiting",
        age: user.age,
        membershipEnd: user.membershipEnd,
        slot: live?.slot,
        joinedAt: live?.joinedAt ?? live?.date,
      };
    });
  }, [camSessions, users, searchText]);

  const totalPages = Math.max(1, Math.ceil(tiles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleTiles = tiles.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const visibleIds = useMemo(
    () => visibleTiles.map((tile) => tile.id),
    [visibleTiles],
  );
  const selectedTile =
    tiles.find((tile) => tile.id === selectedId) ?? visibleTiles[0];
  const workingCount = tiles.filter((tile) => tile.status === "working").length;
  const modeText = isStudyTime
    ? String(activeSlot?.label ?? activeSlot?.slot ?? "수업") + " 집중중"
    : activeSlot
      ? String(activeSlot.label ?? "쉬는시간")
      : "교시 외 시간";
  const liveText =
    liveStatus === "connected"
      ? "실시간 연결됨"
      : liveStatus === "stub"
        ? "LiveKit 설정 대기"
        : liveStatus === "error"
          ? "연결 오류"
          : "연결중";
  const syncVisibleSubscriptions = useCallback((room = roomRef.current) => {
    if (!room) return;
    const visible = new Set(visibleIdsRef.current);

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
  }, []);

  /** EFFECTS **/
  useEffect(() => {
    visibleIdsRef.current = visibleIds;
    syncVisibleSubscriptions();
  }, [syncVisibleSubscriptions, visibleIds]);

  useEffect(() => {
    let mounted = true;
    let localRoom: Room | null = null;

    async function connectAdminViewer() {
      try {
        setLiveStatus("connecting");
        setLiveError("");
        const token = await issueCamToken();

        if (!mounted) return;

        if (!token.url || token.token.startsWith("stub.")) {
          setLiveStatus("stub");
          return;
        }

        const { Room, RoomEvent } = await import("livekit-client");
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        localRoom = room;
        roomRef.current = room;

        room.on(
          RoomEvent.TrackSubscribed,
          (track, publication, participant) => {
            if (String(track.kind) !== "video") return;
            setRemoteVideos((current) => {
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
          setRemoteVideos((current) =>
            current.filter((video) => video.trackSid !== publication.trackSid),
          );
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          setRemoteVideos((current) =>
            current.filter((video) => video.userId !== participant.identity),
          );
        });

        room.on(RoomEvent.TrackPublished, () => {
          syncVisibleSubscriptions(room);
        });

        await room.connect(token.url, token.token, {
          autoSubscribe: false,
        });

        if (!mounted) {
          room.disconnect();
          return;
        }

        setLiveStatus("connected");
        syncVisibleSubscriptions(room);
      } catch (err) {
        console.error("Admin camera LiveKit failed", err);
        if (!mounted) return;
        setLiveStatus("error");
        setLiveError(
          "실시간 캠 연결에 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    }

    connectAdminViewer();

    return () => {
      mounted = false;
      setRemoteVideos([]);
      if (localRoom) {
        localRoom.disconnect();
      }
      if (roomRef.current === localRoom) {
        roomRef.current = null;
      }
    };
  }, [syncVisibleSubscriptions]);

  /** HANDLERS **/
  function goPrevious() {
    setPage((current) => Math.max(1, current - 1));
  }

  function goNext() {
    setPage((current) => Math.min(totalPages, current + 1));
  }

  async function sendWarning(message: string, type?: string) {
    if (!selectedTile || sending) return;
    setSending(true);
    try {
      await onWarn(selectedTile.id, message, type);
      setCustomMessage("");
    } finally {
      setSending(false);
    }
  }

  function videoForUser(userId: string) {
    return remoteVideos.find((video) => video.userId === userId);
  }

  /** RENDER **/
  return (
    <section
      className={
        "admin-camera" + (isStudyTime ? " is-study-time" : " is-info-time")
      }
    >
      <div className="admin-camera-head">
        <div>
          <h2>
            <VideocamOutlinedIcon /> 실시간 작업장 모니터
          </h2>
          <p>
            {isStudyTime
              ? "집중 시간에는 화면과 이름만 간결하게 확인합니다."
              : "쉬는시간에는 회원 정보를 함께 확인합니다."}
          </p>
        </div>

        <div className="admin-camera-stats">
          <span className={"admin-live-status is-" + liveStatus}>
            {liveText}
          </span>
          <span>{modeText}</span>
          <span>
            <i /> {workingCount}명 근무중
          </span>
          <span>{tiles.length - workingCount}명 대기/미입장</span>
        </div>
      </div>

      <label className="admin-search admin-camera-search">
        <span>캠 회원 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="이름, 연락처, 자격증, 지역 검색"
        />
      </label>

      <div className="admin-camera-grid">
        {visibleTiles.map((tile, index) => (
          <button
            className={
              "admin-camera-tile" +
              (selectedTile?.id === tile.id ? " is-selected" : "")
            }
            key={tile.id}
            onClick={() => setSelectedId(tile.id)}
            type="button"
          >
            <div className="admin-camera-video">
              <PersonRoundedIcon />
              {videoForUser(tile.id) && (
                <LiveVideo track={videoForUser(tile.id)!.track} />
              )}
              <strong>{tile.name}</strong>
              <span className={tile.status === "working" ? "is-live" : ""}>
                {videoForUser(tile.id)
                  ? "LIVE"
                  : tile.status === "working"
                    ? "입장"
                    : "OFF"}
              </span>
            </div>

            {!isStudyTime && (
              <div className="admin-camera-meta">
                <div className="admin-camera-title">
                  <strong>{tile.name}</strong>
                  <em>{dDayText(tile.membershipEnd)}</em>
                </div>
                <span>
                  {tile.status === "working"
                    ? String(tile.slot ?? "-") + "교시 입장중"
                    : "미입장"}
                </span>
                <small>
                  {tile.joinedAt
                    ? dateText(tile.joinedAt)
                    : "자리 " + String(index + 1)}
                </small>
                <dl>
                  <div>
                    <dt>나이</dt>
                    <dd>{userDetail(tile.age)}</dd>
                  </div>
                  <div>
                    <dt>결제</dt>
                    <dd>{dDayText(tile.membershipEnd)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </button>
        ))}

        {visibleTiles.length === 0 && (
          <div className="admin-camera-empty">
            <GroupsOutlinedIcon />
            <strong>표시할 회원이 없습니다.</strong>
            <span>회원 등록 후 캠 상태가 이곳에 표시됩니다.</span>
          </div>
        )}
      </div>

      {selectedTile && (
        <div className="admin-warning-panel">
          <div>
            <strong>{selectedTile.name}님에게 알림</strong>
            <span>선택한 문구는 학생 화면에 바로 표시됩니다.</span>
          </div>
          <div className="admin-warning-presets">
            {WARNING_PRESETS.map((preset) => (
              <button
                disabled={sending}
                key={preset.type}
                onClick={() => sendWarning(preset.message, preset.type)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label>
            직접 입력
            <input
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  sendWarning(customMessage, "CUSTOM");
                }
              }}
              placeholder="예) 졸지 말고 집중해주세요."
            />
          </label>
          <button
            className="admin-warning-send"
            disabled={sending || !customMessage.trim()}
            onClick={() => sendWarning(customMessage, "CUSTOM")}
            type="button"
          >
            <SendOutlinedIcon /> {sending ? "전송중" : "보내기"}
          </button>
        </div>
      )}

      {liveError && <p className="admin-camera-live-error">{liveError}</p>}

      <div className="admin-camera-pager">
        <button onClick={goPrevious} disabled={safePage === 1} type="button">
          <NavigateBeforeOutlinedIcon /> 이전
        </button>
        <span>
          {safePage} / {totalPages}
        </span>
        <button
          onClick={goNext}
          disabled={safePage === totalPages}
          type="button"
        >
          다음 <NavigateNextOutlinedIcon />
        </button>
      </div>
    </section>
  );
}
