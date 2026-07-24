/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LocalVideoTrack, Room } from "livekit-client";
import {
  getCamRoomMembers,
  issueCamToken,
  joinCam,
  leaveCam,
} from "../services/cam.service";
import type { CamRoomMember, CamTokenDto } from "../../lib/types";
import { useSocket } from "./SocketContext";

export type RemoteVideoTrack = {
  attach: (element?: HTMLMediaElement) => HTMLMediaElement;
  detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
};

export type RemoteVideo = {
  trackSid: string;
  userId: string;
  track: RemoteVideoTrack;
};

export type CameraEffect =
  | "original"
  | "background-blur"
  | "privacy-mask";

type EffectSupportState = "unknown" | "supported" | "unsupported";

type CameraEffectSupport = {
  "background-blur": EffectSupportState;
  "privacy-mask": EffectSupportState;
};

const createInitialEffectSupport = (): CameraEffectSupport => ({
  "background-blur": "unknown",
  "privacy-mask": "unknown",
});

type WorkroomSessionValue = {
  joined: boolean;
  joining: boolean;
  cameraReady: boolean;
  error: string;
  localVideoTrack: LocalVideoTrack | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  selectedEffect: CameraEffect;
  effectSupport: CameraEffectSupport;
  effectLoading: boolean;
  effectError: string;
  roomMembers: CamRoomMember[];
  remoteVideos: RemoteVideo[];
  previewCamera: (deviceId?: string) => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  selectCameraEffect: (effect: CameraEffect) => Promise<void>;
  startSession: (slot?: number) => Promise<boolean>;
  leaveSession: () => Promise<void>;
  setVisibleRemoteUserIds: (userIds: string[]) => void;
};

const WorkroomSessionContext = createContext<WorkroomSessionValue | null>(null);

export function WorkroomSessionProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");
  const [localVideoTrack, setLocalVideoTrack] =
    useState<LocalVideoTrack | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedEffect, setSelectedEffect] =
    useState<CameraEffect>("original");
  const [effectSupport, setEffectSupport] =
    useState<CameraEffectSupport>(createInitialEffectSupport);
  const [effectLoading, setEffectLoading] = useState(false);
  const [effectError, setEffectError] = useState("");
  const [roomMembers, setRoomMembers] = useState<CamRoomMember[]>([]);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const roomRef = useRef<Room | null>(null);
  const camTokenRef = useRef<CamTokenDto | null>(null);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const visibleRemoteUserIdsRef = useRef<string[]>([]);

  const refreshRoomMembers = useCallback(async () => {
    try {
      const members = await getCamRoomMembers();
      setRoomMembers(members);
    } catch {
      setRoomMembers([]);
    }
  }, []);

  const syncRemoteCameraSubscriptions = useCallback(
    (room = roomRef.current) => {
      if (!room) return;
      const visible = new Set(visibleRemoteUserIdsRef.current);

      room.remoteParticipants.forEach((participant) => {
        const shouldSubscribe = visible.has(participant.identity);
        participant.trackPublications.forEach((publication) => {
          const isVideo =
            String(publication.kind) === "video" ||
            String(publication.source) === "camera";
          if (isVideo) publication.setSubscribed(shouldSubscribe);
        });
      });
    },
    [],
  );

  const setVisibleRemoteUserIds = useCallback(
    (userIds: string[]) => {
      visibleRemoteUserIdsRef.current = userIds;
      syncRemoteCameraSubscriptions();
    },
    [syncRemoteCameraSubscriptions],
  );

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const cameras = allDevices.filter((device) => device.kind === "videoinput");
    setDevices(cameras);
    setSelectedDeviceId((current) => current || cameras[0]?.deviceId || "");
  }, []);

  const stopLocalCamera = useCallback(async () => {
    const track = localVideoTrackRef.current;

    localVideoTrackRef.current = null;
    setLocalVideoTrack(null);
    setCameraReady(false);
    setSelectedEffect("original");
    setEffectSupport(createInitialEffectSupport());
    setEffectLoading(false);
    setEffectError("");

    if (!track) return;

    try {
      if (track.getProcessor()) await track.stopProcessor(false);
    } finally {
      track.stop();
    }
  }, []);

  const startLocalCamera = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("이 브라우저에서는 카메라를 사용할 수 없습니다.");
      }

      const currentTrack = localVideoTrackRef.current;
      if (currentTrack) {
        if (deviceId) {
          const currentDeviceId = await currentTrack.getDeviceId();
          if (currentDeviceId !== deviceId) {
            const changed = await currentTrack.setDeviceId(deviceId);
            if (!changed) {
              throw new Error("선택한 카메라로 변경하지 못했습니다.");
            }
          }
        }

        setCameraReady(true);
        await refreshDevices();
        return currentTrack;
      }

      const { createLocalVideoTrack } = await import("livekit-client");
      const isCompact = window.matchMedia("(max-width: 699px)").matches;
      const track = await createLocalVideoTrack({
        deviceId: deviceId || undefined,
        resolution: {
          width: isCompact ? 640 : 960,
          height: isCompact ? 360 : 540,
          frameRate: 24,
        },
      });

      localVideoTrackRef.current = track;
      setLocalVideoTrack(track);
      setCameraReady(true);
      setSelectedDeviceId((await track.getDeviceId()) ?? deviceId ?? "");
      await refreshDevices();
      return track;
    },
    [refreshDevices],
  );

  const disconnectLiveKit = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setRemoteVideos([]);
  }, []);

  const selectCameraEffect = useCallback(async (effect: CameraEffect) => {
    const track = localVideoTrackRef.current;
    setEffectError("");

    if (!track) {
      setEffectError("카메라 미리보기를 먼저 시작해 주세요.");
      return;
    }

    if (effect === "original") {
      setEffectLoading(true);
      try {
        if (track.getProcessor()) await track.stopProcessor(false);
        setSelectedEffect("original");
      } catch {
        setEffectError("원본 화면으로 전환하지 못했습니다.");
      } finally {
        setEffectLoading(false);
      }
      return;
    }

    setEffectLoading(true);
    try {
      if (effect === "background-blur") {
        const {
          BackgroundBlur,
          supportsBackgroundProcessors,
          supportsModernBackgroundProcessors,
        } = await import("@livekit/track-processors");

        if (!supportsBackgroundProcessors()) {
          setEffectSupport((current) => ({
            ...current,
            "background-blur": "unsupported",
          }));
          setEffectError("이 기기에서는 배경 흐림 효과를 지원하지 않습니다.");
          return;
        }

        const processor = BackgroundBlur(10, undefined, undefined, {
          maxFps: supportsModernBackgroundProcessors() ? 24 : 18,
        });
        await track.setProcessor(processor, true);
        setEffectSupport((current) => ({
          ...current,
          "background-blur": "supported",
        }));
        setSelectedEffect("background-blur");
        return;
      }

      const {
        createPrivacyMaskProcessor,
        supportsPrivacyMaskProcessor,
      } = await import("../utils/privacy-mask-processor");

      if (!supportsPrivacyMaskProcessor()) {
        setEffectSupport((current) => ({
          ...current,
          "privacy-mask": "unsupported",
        }));
        setEffectError("이 기기에서는 얼굴 가리기 효과를 지원하지 않습니다.");
        return;
      }

      const processor = createPrivacyMaskProcessor();
      await track.setProcessor(processor, true);
      setEffectSupport((current) => ({
        ...current,
        "privacy-mask": "supported",
      }));
      setSelectedEffect("privacy-mask");
    } catch {
      try {
        if (track.getProcessor()) await track.stopProcessor(false);
      } catch {
        // Keep the original camera usable even if processor cleanup fails.
      }
      setSelectedEffect("original");
      setEffectError(
        effect === "privacy-mask"
          ? "얼굴 가리기 효과를 준비하지 못했습니다. 원본을 다시 선택해 주세요."
          : "배경 흐림 효과를 준비하지 못했습니다. 원본을 다시 선택해 주세요.",
      );
    } finally {
      setEffectLoading(false);
    }
  }, []);

  const connectLiveKit = useCallback(
    async (token: CamTokenDto) => {
      if (!token.url || token.token.startsWith("stub.")) return;

      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true, dynacast: true });

      try {
        room.on(
          RoomEvent.TrackSubscribed,
          (track, publication, participant) => {
            if (String(track.kind) !== "video") return;
            setRemoteVideos((current) => [
              ...current.filter(
                (video) => video.trackSid !== publication.trackSid,
              ),
              {
                trackSid: publication.trackSid,
                userId: participant.identity,
                track: track as RemoteVideoTrack,
              },
            ]);
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
          syncRemoteCameraSubscriptions(room);
        });

        await room.connect(token.url, token.token, { autoSubscribe: false });
        roomRef.current = room;
        syncRemoteCameraSubscriptions(room);

        if (token.canPublish) {
          const videoTrack = localVideoTrackRef.current;
          if (videoTrack) {
            await room.localParticipant.publishTrack(videoTrack, {
              source: Track.Source.Camera,
            });
          }
        }
      } catch (err) {
        room.disconnect();
        if (roomRef.current === room) roomRef.current = null;
        throw err;
      }
    },
    [syncRemoteCameraSubscriptions],
  );

  const previewCamera = useCallback(
    async (deviceId?: string) => {
      setError("");
      if (joiningRef.current) return;
      joiningRef.current = true;
      setJoining(true);
      try {
        await startLocalCamera(deviceId ?? (selectedDeviceId || undefined));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "카메라 미리보기를 시작하지 못했습니다.",
        );
      } finally {
        joiningRef.current = false;
        setJoining(false);
      }
    },
    [selectedDeviceId, startLocalCamera],
  );

  const selectCamera = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      setError("");
      try {
        await startLocalCamera(deviceId || undefined);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "카메라를 변경하지 못했습니다.",
        );
      }
    },
    [startLocalCamera],
  );

  const leaveSession = useCallback(async () => {
    const wasJoined = joinedRef.current;
    disconnectLiveKit();
    await stopLocalCamera();
    joinedRef.current = false;
    camTokenRef.current = null;
    setJoined(false);
    setError("");

    if (wasJoined) {
      try {
        await leaveCam();
      } catch {
        // Local camera cleanup still happens when the presence request fails.
      }
    }
    await refreshRoomMembers();
  }, [disconnectLiveKit, refreshRoomMembers, stopLocalCamera]);

  const startSession = useCallback(
    async (slot?: number) => {
      if (joinedRef.current) return true;
      if (joiningRef.current) return false;

      setError("");
      joiningRef.current = true;
      setJoining(true);
      try {
        const token = await issueCamToken();
        if (!localVideoTrackRef.current) {
          await startLocalCamera(selectedDeviceId || undefined);
        }
        await connectLiveKit(token);
        await joinCam(slot);
        joinedRef.current = true;
        camTokenRef.current = token;
        setJoined(true);
        await refreshRoomMembers();
        return true;
      } catch (err) {
        disconnectLiveKit();
        await stopLocalCamera();
        joinedRef.current = false;
        camTokenRef.current = null;
        setError(
          err instanceof Error
            ? err.message
            : "작업장 입장 상태를 변경하지 못했습니다.",
        );
        return false;
      } finally {
        joiningRef.current = false;
        setJoining(false);
      }
    },
    [
      connectLiveKit,
      disconnectLiveKit,
      refreshRoomMembers,
      selectedDeviceId,
      startLocalCamera,
      stopLocalCamera,
    ],
  );

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
    if (!socket) return;
    socket.on("cam:join", refreshRoomMembers);
    socket.on("cam:leave", refreshRoomMembers);
    return () => {
      socket.off("cam:join", refreshRoomMembers);
      socket.off("cam:leave", refreshRoomMembers);
    };
  }, [refreshRoomMembers, socket]);

  useEffect(() => {
    return () => {
      void leaveSession();
    };
  }, [leaveSession]);

  return (
    <WorkroomSessionContext.Provider
      value={{
        joined,
        joining,
        cameraReady,
        error,
        localVideoTrack,
        devices,
        selectedDeviceId,
        selectedEffect,
        effectSupport,
        effectLoading,
        effectError,
        roomMembers,
        remoteVideos,
        previewCamera,
        selectCamera,
        selectCameraEffect,
        startSession,
        leaveSession,
        setVisibleRemoteUserIds,
      }}
    >
      {children}
    </WorkroomSessionContext.Provider>
  );
}

export function useWorkroomSession() {
  const context = useContext(WorkroomSessionContext);
  if (!context) {
    throw new Error(
      "useWorkroomSession must be used inside WorkroomSessionProvider",
    );
  }
  return context;
}
