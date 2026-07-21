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
import type { Room } from "livekit-client";
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

type WorkroomSessionValue = {
  joined: boolean;
  joining: boolean;
  cameraReady: boolean;
  error: string;
  localStream: MediaStream | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  roomMembers: CamRoomMember[];
  remoteVideos: RemoteVideo[];
  previewCamera: (deviceId?: string) => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [roomMembers, setRoomMembers] = useState<CamRoomMember[]>([]);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const publishedVideoTrackRef = useRef<MediaStreamTrack | null>(null);
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

  const stopLocalCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
    setCameraReady(false);
  }, []);

  const startLocalCamera = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("이 브라우저에서는 카메라를 사용할 수 없습니다.");
      }

      stopLocalCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      });

      streamRef.current = stream;
      setLocalStream(stream);
      setCameraReady(true);
      await refreshDevices();
    },
    [refreshDevices, stopLocalCamera],
  );

  const disconnectLiveKit = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    publishedVideoTrackRef.current = null;
    setRemoteVideos([]);
  }, []);

  const unpublishCameraTrack = useCallback(async () => {
    const room = roomRef.current;
    const publishedTrack = publishedVideoTrackRef.current;
    if (!room || !publishedTrack) {
      publishedVideoTrackRef.current = null;
      return;
    }

    await room.localParticipant.unpublishTrack(publishedTrack);
    publishedVideoTrackRef.current = null;
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
        if (joinedRef.current) await unpublishCameraTrack();
        await startLocalCamera(deviceId || undefined);

        const room = roomRef.current;
        const token = camTokenRef.current;
        const newTrack = streamRef.current?.getVideoTracks()[0];
        if (room && token?.canPublish && newTrack) {
          const { Track } = await import("livekit-client");
          await room.localParticipant.publishTrack(newTrack, {
            source: Track.Source.Camera,
          });
          publishedVideoTrackRef.current = newTrack;
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "카메라를 변경하지 못했습니다.",
        );
      }
    },
    [startLocalCamera, unpublishCameraTrack],
  );

  const leaveSession = useCallback(async () => {
    const wasJoined = joinedRef.current;
    disconnectLiveKit();
    stopLocalCamera();
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
        await startLocalCamera(selectedDeviceId || undefined);
        await connectLiveKit(token);
        await joinCam(slot);
        joinedRef.current = true;
        camTokenRef.current = token;
        setJoined(true);
        await refreshRoomMembers();
        return true;
      } catch (err) {
        disconnectLiveKit();
        stopLocalCamera();
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
        localStream,
        devices,
        selectedDeviceId,
        roomMembers,
        remoteVideos,
        previewCamera,
        selectCamera,
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
