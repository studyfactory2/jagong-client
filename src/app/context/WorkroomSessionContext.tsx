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
import type { ProcessorWrapper } from "@livekit/track-processors";
import {
  getCamRoomMembers,
  issueCamToken,
  leaveCam,
} from "../services/cam.service";
import {
  getMyStudyTimeStatus,
  resumeMyStudy,
  startMyStudyBreak,
} from "../services/study-time.service";
import { syncCamAttendance } from "../services/attendance.service";
import type {
  CamRoomMember,
  CamTokenDto,
  StudyTimeStatus,
} from "../../lib/types";
import { useSocket } from "./SocketContext";
import type {
  FaceEffectOptions,
  FaceEffectVariant,
} from "../utils/landmarker-effect-processor";

export type RemoteVideoTrack = {
  attach: (element?: HTMLMediaElement) => HTMLMediaElement;
  detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
};

export type RemoteVideo = {
  trackSid: string;
  userId: string;
  track: RemoteVideoTrack;
  muted: boolean;
};

export type CameraEffect = "original" | "background-blur" | FaceEffectVariant;

type EffectSupportState = "unknown" | "supported" | "unsupported";

type CameraEffectSupport = {
  "background-blur": EffectSupportState;
} & Record<FaceEffectVariant, EffectSupportState>;

const FACE_EFFECTS: FaceEffectVariant[] = [
  "cat",
  "dog",
  "bear",
  "bunny",
  "fox",
  "medical-mask",
  "beard",
  "glasses",
];

const isFaceEffect = (effect: CameraEffect): effect is FaceEffectVariant =>
  FACE_EFFECTS.includes(effect as FaceEffectVariant);

const FACE_EFFECT_LABELS: Record<FaceEffectVariant, string> = {
  cat: "고양이",
  dog: "강아지",
  bear: "곰",
  bunny: "토끼",
  fox: "여우",
  "medical-mask": "마스크",
  beard: "수염",
  glasses: "안경",
};

const CAMERA_DIMENSION_SAMPLE_INTERVAL_MS = 60;
const CAMERA_DIMENSION_WAIT_MS = 1200;
const STUDY_STATUS_REFRESH_INTERVAL_MS = 60000;
const STUDY_STATUS_BOUNDARY_OFFSET_MS = 1500;
const STUDY_STATUS_STARTUP_RETRY_MS = [
  0, 250, 500, 1000, 1500, 2000, 3000, 4000,
];
const ATTENDANCE_SYNC_RETRY_MS = [500, 1000, 2000, 4000];
const ATTENDANCE_SYNC_TIMEOUT_MS = 8000;
const CAMERA_RESUME_RETRY_DELAYS_MS = [0, 200, 500];
const CAMERA_NOT_READY_ERROR = "카메라를 켠 뒤 공부를 계속할 수 있습니다.";

// A provider unmount can overlap a fast return to the workroom route. Keep
// camera teardown process-wide so the next provider never captures while the
// previous processor/track is still stopping.
let pendingCameraCleanup: Promise<void> | null = null;

function isConfirmedStudyResume(status: StudyTimeStatus): boolean {
  return (
    status.active === true &&
    status.state === "STUDY" &&
    status.source !== "SYSTEM"
  );
}

function isConfirmedStudyBreak(status: StudyTimeStatus | null): boolean {
  return status?.active === true && status.state === "BREAK";
}

const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function seoulDateKey(date = new Date()): string {
  const parts = seoulDateFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

type StudyAction = "BREAK" | "RESUME";

type PendingStudyAction = {
  action: StudyAction;
  connectionGeneration: number;
  requestId: number;
};

type AttendanceSyncTarget = {
  connectionGeneration: number;
  key: string;
  slot: number;
};

type AttendanceSyncFlight = {
  controller: AbortController;
  target: AttendanceSyncTarget;
  timeoutId: number | null;
};

class WorkroomConnectionCancelledError extends Error {
  constructor() {
    super("Workroom connection was cancelled.");
    this.name = "WorkroomConnectionCancelledError";
  }
}

async function waitForStableCameraDimensions(track: LocalVideoTrack) {
  const deadline = performance.now() + CAMERA_DIMENSION_WAIT_MS;
  let lastDimensions = "";
  let stableSamples = 0;

  while (performance.now() < deadline) {
    const { width, height } = track.getSourceTrackSettings();
    const dimensions = width && height ? `${width}x${height}` : "";

    if (dimensions) {
      if (dimensions === lastDimensions) {
        stableSamples += 1;
      } else {
        lastDimensions = dimensions;
        stableSamples = 1;
      }

      if (stableSamples >= 3) return;
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, CAMERA_DIMENSION_SAMPLE_INTERVAL_MS);
    });
  }
}

const createInitialEffectSupport = (): CameraEffectSupport => ({
  "background-blur": "unknown",
  cat: "unknown",
  dog: "unknown",
  bear: "unknown",
  bunny: "unknown",
  fox: "unknown",
  "medical-mask": "unknown",
  beard: "unknown",
  glasses: "unknown",
});

type WorkroomSessionValue = {
  joined: boolean;
  joining: boolean;
  cameraReady: boolean;
  cameraPausedForBreak: boolean;
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
  studyStatus: StudyTimeStatus | null;
  studyStatusLoading: boolean;
  studyStatusError: string;
  studyActionPending: StudyAction | null;
  previewCamera: (deviceId?: string) => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  selectCameraEffect: (effect: CameraEffect) => Promise<void>;
  startSession: (slot?: number) => Promise<boolean>;
  leaveSession: () => Promise<void>;
  syncAttendanceSlot: (slot?: number, force?: boolean) => void;
  refreshStudyStatus: () => Promise<void>;
  startStudyBreak: () => Promise<boolean>;
  resumeStudy: () => Promise<boolean>;
  setVisibleRemoteUserIds: (userIds: string[]) => void;
};

const WorkroomSessionContext = createContext<WorkroomSessionValue | null>(null);

export function WorkroomSessionProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPausedForBreak, setCameraPausedForBreak] = useState(false);
  const [error, setError] = useState("");
  const [localVideoTrack, setLocalVideoTrack] =
    useState<LocalVideoTrack | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedEffect, setSelectedEffect] =
    useState<CameraEffect>("original");
  const [effectSupport, setEffectSupport] = useState<CameraEffectSupport>(
    createInitialEffectSupport,
  );
  const [effectLoading, setEffectLoading] = useState(false);
  const [effectError, setEffectError] = useState("");
  const [roomMembers, setRoomMembers] = useState<CamRoomMember[]>([]);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const [studyStatus, setStudyStatus] = useState<StudyTimeStatus | null>(null);
  const [studyStatusLoading, setStudyStatusLoading] = useState(false);
  const [studyStatusError, setStudyStatusError] = useState("");
  const [studyActionPending, setStudyActionPending] =
    useState<StudyAction | null>(null);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const cameraCleanupPromiseRef = useRef<Promise<void> | null>(null);
  const leaveSessionPromiseRef = useRef<Promise<void> | null>(null);
  const faceEffectProcessorRef =
    useRef<ProcessorWrapper<FaceEffectOptions> | null>(null);
  const roomRef = useRef<Room | null>(null);
  const participantSidRef = useRef<string | null>(null);
  const connectionGenerationRef = useRef(0);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const leavingRef = useRef(false);
  const visibleRemoteUserIdsRef = useRef<ReadonlySet<string>>(new Set());
  const visibleRemoteClearTimerRef = useRef<number | null>(null);
  const studyStatusRequestRef = useRef(0);
  const studyStatusLoadingRequestRef = useRef<number | null>(null);
  const studyStatusRefreshQueuedRef = useRef(false);
  const studyActionPendingRef = useRef<PendingStudyAction | null>(null);
  const attendanceTargetRef = useRef<AttendanceSyncTarget | null>(null);
  const attendanceInFlightRef = useRef<AttendanceSyncFlight | null>(null);
  const attendanceRetryTimerRef = useRef<number | null>(null);
  const attendanceRetryIndexRef = useRef(0);
  const attendanceBindingReadyRef = useRef(false);
  const lastSyncedAttendanceKeyRef = useRef<string | null>(null);
  const flushAttendanceSyncRef = useRef<() => void>(() => undefined);
  const mountedRef = useRef(true);

  const clearAttendanceRetry = useCallback(() => {
    if (attendanceRetryTimerRef.current !== null) {
      window.clearTimeout(attendanceRetryTimerRef.current);
      attendanceRetryTimerRef.current = null;
    }
  }, []);

  const cancelAttendanceFlight = useCallback(() => {
    const flight = attendanceInFlightRef.current;
    if (!flight) return;

    attendanceInFlightRef.current = null;
    if (flight.timeoutId !== null) window.clearTimeout(flight.timeoutId);
    flight.controller.abort();
  }, []);

  const resetAttendanceSync = useCallback(() => {
    clearAttendanceRetry();
    cancelAttendanceFlight();
    attendanceTargetRef.current = null;
    attendanceRetryIndexRef.current = 0;
    attendanceBindingReadyRef.current = false;
    lastSyncedAttendanceKeyRef.current = null;
  }, [cancelAttendanceFlight, clearAttendanceRetry]);

  const flushAttendanceSync = useCallback(() => {
    const target = attendanceTargetRef.current;
    if (
      !target ||
      !mountedRef.current ||
      !joinedRef.current ||
      !attendanceBindingReadyRef.current ||
      target.connectionGeneration !== connectionGenerationRef.current ||
      lastSyncedAttendanceKeyRef.current === target.key ||
      attendanceRetryTimerRef.current !== null ||
      attendanceInFlightRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    const flight: AttendanceSyncFlight = {
      controller,
      target,
      timeoutId: null,
    };
    attendanceInFlightRef.current = flight;
    flight.timeoutId = window.setTimeout(() => {
      flight.timeoutId = null;
      controller.abort();
    }, ATTENDANCE_SYNC_TIMEOUT_MS);

    void syncCamAttendance(target.slot, controller.signal)
      .then(() => {
        if (
          attendanceInFlightRef.current !== flight ||
          attendanceTargetRef.current !== target ||
          connectionGenerationRef.current !== target.connectionGeneration
        ) {
          return;
        }

        lastSyncedAttendanceKeyRef.current = target.key;
        attendanceRetryIndexRef.current = 0;
        clearAttendanceRetry();
      })
      .catch(() => {
        if (
          attendanceInFlightRef.current !== flight ||
          attendanceTargetRef.current !== target ||
          connectionGenerationRef.current !== target.connectionGeneration ||
          !attendanceBindingReadyRef.current
        ) {
          return;
        }

        const delay = ATTENDANCE_SYNC_RETRY_MS[attendanceRetryIndexRef.current];
        if (delay === undefined) return;

        attendanceRetryIndexRef.current += 1;
        clearAttendanceRetry();
        attendanceRetryTimerRef.current = window.setTimeout(() => {
          attendanceRetryTimerRef.current = null;
          flushAttendanceSyncRef.current();
        }, delay);
      })
      .finally(() => {
        if (flight.timeoutId !== null) window.clearTimeout(flight.timeoutId);
        if (attendanceInFlightRef.current === flight) {
          attendanceInFlightRef.current = null;
        }

        if (
          attendanceTargetRef.current &&
          attendanceTargetRef.current !== target
        ) {
          flushAttendanceSyncRef.current();
        }
      });
  }, [clearAttendanceRetry]);

  useEffect(() => {
    flushAttendanceSyncRef.current = flushAttendanceSync;
    return () => {
      flushAttendanceSyncRef.current = () => undefined;
    };
  }, [flushAttendanceSync]);

  const syncAttendanceSlot = useCallback(
    (slot?: number, force = false) => {
      if (!slot || slot <= 0) {
        cancelAttendanceFlight();
        attendanceTargetRef.current = null;
        attendanceRetryIndexRef.current = 0;
        clearAttendanceRetry();
        return;
      }

      const connectionGeneration = connectionGenerationRef.current;
      const key = `${seoulDateKey()}:${slot}`;
      const current = attendanceTargetRef.current;
      if (
        !force &&
        current?.key === key &&
        current.connectionGeneration === connectionGeneration
      ) {
        flushAttendanceSync();
        return;
      }

      clearAttendanceRetry();
      cancelAttendanceFlight();
      attendanceRetryIndexRef.current = 0;
      if (force) lastSyncedAttendanceKeyRef.current = null;
      attendanceTargetRef.current = { connectionGeneration, key, slot };
      flushAttendanceSync();
    },
    [cancelAttendanceFlight, clearAttendanceRetry, flushAttendanceSync],
  );

  const setAttendanceBindingReady = useCallback(
    (
      ready: boolean,
      expectedConnectionGeneration = connectionGenerationRef.current,
    ) => {
      if (expectedConnectionGeneration !== connectionGenerationRef.current) {
        return;
      }

      attendanceBindingReadyRef.current = ready;
      if (ready) {
        flushAttendanceSync();
      } else {
        cancelAttendanceFlight();
        clearAttendanceRetry();
      }
    },
    [cancelAttendanceFlight, clearAttendanceRetry, flushAttendanceSync],
  );

  const commitStudyStatus = useCallback((status: StudyTimeStatus) => {
    if (mountedRef.current) setStudyStatus(status);
  }, []);

  const commitCameraPausedForBreak = useCallback(
    (
      paused: boolean,
      expectedConnectionGeneration = connectionGenerationRef.current,
    ) => {
      if (
        !mountedRef.current ||
        connectionGenerationRef.current !== expectedConnectionGeneration
      ) {
        return;
      }

      setCameraPausedForBreak(paused);
    },
    [],
  );

  const resetCameraPausedForBreak = useCallback(() => {
    if (mountedRef.current) setCameraPausedForBreak(false);
  }, []);

  const requireCurrentStudyCamera = useCallback(
    (
      expectedConnectionGeneration: number,
      expectedTrack?: LocalVideoTrack,
      expectedRoom?: Room,
    ) => {
      if (
        !mountedRef.current ||
        !joinedRef.current ||
        connectionGenerationRef.current !== expectedConnectionGeneration
      ) {
        throw new WorkroomConnectionCancelledError();
      }

      const track = localVideoTrackRef.current;
      const room = roomRef.current;
      if (!track || !room) {
        throw new Error("작업장 카메라 연결을 찾을 수 없습니다.");
      }
      if (
        (expectedTrack && track !== expectedTrack) ||
        (expectedRoom && room !== expectedRoom)
      ) {
        throw new WorkroomConnectionCancelledError();
      }

      return { room, track };
    },
    [],
  );

  const resetStudyStatus = useCallback(() => {
    studyStatusRequestRef.current += 1;
    studyStatusLoadingRequestRef.current = null;
    studyStatusRefreshQueuedRef.current = false;
    studyActionPendingRef.current = null;
    if (!mountedRef.current) return;
    setStudyStatus(null);
    setStudyStatusLoading(false);
    setStudyStatusError("");
    setStudyActionPending(null);
  }, []);

  const resumeStudyWithVerifiedCamera = useCallback(
    async (
      expectedConnectionGeneration: number,
      expectedTrack: LocalVideoTrack,
      expectedRoom: Room,
    ): Promise<StudyTimeStatus> => {
      let lastError: unknown = new Error("카메라 상태를 확인하지 못했습니다.");

      for (
        let index = 0;
        index < CAMERA_RESUME_RETRY_DELAYS_MS.length;
        index += 1
      ) {
        const delay = CAMERA_RESUME_RETRY_DELAYS_MS[index];
        if (delay > 0) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, delay);
          });
        }
        requireCurrentStudyCamera(
          expectedConnectionGeneration,
          expectedTrack,
          expectedRoom,
        );

        try {
          const status = await resumeMyStudy();
          requireCurrentStudyCamera(
            expectedConnectionGeneration,
            expectedTrack,
            expectedRoom,
          );
          if (!isConfirmedStudyResume(status)) {
            throw new Error("공부 상태 재개를 확인하지 못했습니다.");
          }
          return status;
        } catch (requestError) {
          requireCurrentStudyCamera(
            expectedConnectionGeneration,
            expectedTrack,
            expectedRoom,
          );
          lastError = requestError;
          const canRetry =
            requestError instanceof Error &&
            requestError.message === CAMERA_NOT_READY_ERROR &&
            index < CAMERA_RESUME_RETRY_DELAYS_MS.length - 1;
          if (!canRetry) throw requestError;
        }
      }

      throw lastError;
    },
    [requireCurrentStudyCamera],
  );

  const confirmBackendStudyBreak = useCallback(
    async (
      expectedConnectionGeneration: number,
      expectedTrack: LocalVideoTrack,
      expectedRoom: Room,
    ): Promise<boolean> => {
      let status: StudyTimeStatus | null = null;
      try {
        status = await startMyStudyBreak();
      } catch {
        // A lost response can still mean the server committed the break.
      }
      requireCurrentStudyCamera(
        expectedConnectionGeneration,
        expectedTrack,
        expectedRoom,
      );
      if (isConfirmedStudyBreak(status)) return true;

      try {
        status = await getMyStudyTimeStatus();
      } catch {
        status = null;
      }
      requireCurrentStudyCamera(
        expectedConnectionGeneration,
        expectedTrack,
        expectedRoom,
      );
      return isConfirmedStudyBreak(status);
    },
    [requireCurrentStudyCamera],
  );

  const failClosedStudyCamera = useCallback(
    async (
      expectedConnectionGeneration: number,
      expectedTrack: LocalVideoTrack,
      expectedRoom: Room,
      message: string,
      ensureBackendBreak: boolean,
    ): Promise<never> => {
      requireCurrentStudyCamera(
        expectedConnectionGeneration,
        expectedTrack,
        expectedRoom,
      );

      const participantSid = participantSidRef.current;
      try {
        expectedTrack.stop();
      } catch {
        // Continue disconnecting even if the stopped track reports an error.
      }

      connectionGenerationRef.current = expectedConnectionGeneration + 1;
      roomRef.current = null;
      participantSidRef.current = null;
      localVideoTrackRef.current = null;
      joinedRef.current = false;
      joiningRef.current = false;
      leavingRef.current = false;
      resetCameraPausedForBreak();
      resetStudyStatus();
      resetAttendanceSync();
      setJoined(false);
      setJoining(false);
      setLocalVideoTrack(null);
      setCameraReady(false);
      setSelectedEffect("original");
      setEffectSupport(createInitialEffectSupport());
      setEffectLoading(false);
      setEffectError("");
      faceEffectProcessorRef.current = null;
      setRemoteVideos([]);
      setError(message);

      if (participantSid) {
        void leaveCam({ participantSid }).catch(() => undefined);
      }

      const cleanupTasks: Promise<unknown>[] = [
        expectedRoom.disconnect().catch(() => undefined),
      ];
      if (ensureBackendBreak) {
        cleanupTasks.push(startMyStudyBreak().catch(() => undefined));
      }
      await Promise.all(cleanupTasks);
      throw new WorkroomConnectionCancelledError();
    },
    [
      requireCurrentStudyCamera,
      resetAttendanceSync,
      resetCameraPausedForBreak,
      resetStudyStatus,
    ],
  );

  const restoreMemberBreakCamera = useCallback(
    async (
      status: StudyTimeStatus,
      expectedConnectionGeneration: number,
      requestId: number,
    ) => {
      if (
        status.active !== true ||
        status.state !== "BREAK" ||
        status.source !== "MEMBER"
      ) {
        return;
      }

      const { room, track } = requireCurrentStudyCamera(
        expectedConnectionGeneration,
      );
      if (!track.isMuted) {
        try {
          await track.mute();
        } catch {
          // The track flag below decides whether the privacy state was restored.
        }
        requireCurrentStudyCamera(
          expectedConnectionGeneration,
          track,
          room,
        );
      }

      if (studyStatusRequestRef.current !== requestId) return;
      if (!track.isMuted) {
        return await failClosedStudyCamera(
          expectedConnectionGeneration,
          track,
          room,
          "저장된 휴식 상태에서 카메라를 안전하게 끄지 못해 작업실 연결을 종료했습니다. 다시 입장해 주세요.",
          false,
        );
      }
      commitCameraPausedForBreak(true, expectedConnectionGeneration);
    },
    [
      commitCameraPausedForBreak,
      failClosedStudyCamera,
      requireCurrentStudyCamera,
    ],
  );

  const loadStudyStatus = useCallback(
    async (
      showLoading = false,
      expectedConnectionGeneration = connectionGenerationRef.current,
    ): Promise<StudyTimeStatus | null> => {
      if (!joinedRef.current) return null;
      if (studyActionPendingRef.current) {
        studyStatusRefreshQueuedRef.current = true;
        return null;
      }

      const requestId = studyStatusRequestRef.current + 1;
      studyStatusRequestRef.current = requestId;
      if (showLoading || studyStatusLoadingRequestRef.current !== null) {
        studyStatusLoadingRequestRef.current = requestId;
      }
      if (showLoading && mountedRef.current) {
        setStudyStatusLoading(true);
      }

      try {
        const status = await getMyStudyTimeStatus();
        if (
          !mountedRef.current ||
          !joinedRef.current ||
          connectionGenerationRef.current !== expectedConnectionGeneration ||
          studyStatusRequestRef.current !== requestId
        ) {
          return null;
        }
        await restoreMemberBreakCamera(
          status,
          expectedConnectionGeneration,
          requestId,
        );
        if (
          !mountedRef.current ||
          !joinedRef.current ||
          connectionGenerationRef.current !== expectedConnectionGeneration ||
          studyStatusRequestRef.current !== requestId
        ) {
          return null;
        }
        setAttendanceBindingReady(
          Boolean(
            status.active &&
            status.state &&
            status.source &&
            status.source !== "SYSTEM",
          ),
          expectedConnectionGeneration,
        );
        commitStudyStatus(status);
        setStudyStatusError("");
        return status;
      } catch (requestError) {
        if (
          mountedRef.current &&
          joinedRef.current &&
          connectionGenerationRef.current === expectedConnectionGeneration &&
          studyStatusRequestRef.current === requestId
        ) {
          setStudyStatusError(
            requestError instanceof Error
              ? requestError.message
              : "공부 상태를 확인하지 못했습니다.",
          );
        }
        return null;
      } finally {
        if (
          mountedRef.current &&
          studyStatusLoadingRequestRef.current === requestId
        ) {
          studyStatusLoadingRequestRef.current = null;
          setStudyStatusLoading(false);
        }
      }
    },
    [commitStudyStatus, restoreMemberBreakCamera, setAttendanceBindingReady],
  );

  const refreshStudyStatus = useCallback(async () => {
    await loadStudyStatus(true);
  }, [loadStudyStatus]);

  const runStudyAction = useCallback(
    async (
      action: StudyAction,
      request: (
        expectedConnectionGeneration: number,
      ) => Promise<StudyTimeStatus>,
      fallbackError: string,
    ): Promise<boolean> => {
      if (!joinedRef.current || studyActionPendingRef.current) return false;

      const expectedConnectionGeneration = connectionGenerationRef.current;
      const requestId = studyStatusRequestRef.current + 1;
      studyStatusRequestRef.current = requestId;
      const pendingAction: PendingStudyAction = {
        action,
        connectionGeneration: expectedConnectionGeneration,
        requestId,
      };
      studyActionPendingRef.current = pendingAction;
      if (mountedRef.current) {
        setStudyActionPending(action);
        setStudyStatusError("");
      }

      let actionSucceeded = false;

      try {
        const status = await request(expectedConnectionGeneration);
        if (
          !mountedRef.current ||
          !joinedRef.current ||
          connectionGenerationRef.current !== expectedConnectionGeneration ||
          studyStatusRequestRef.current !== requestId
        ) {
          return false;
        }
        commitStudyStatus(status);
        actionSucceeded = true;
        return true;
      } catch (requestError) {
        if (requestError instanceof WorkroomConnectionCancelledError) {
          return false;
        }

        const message =
          requestError instanceof Error ? requestError.message : fallbackError;

        try {
          const reconciled = await getMyStudyTimeStatus();
          if (
            mountedRef.current &&
            joinedRef.current &&
            connectionGenerationRef.current === expectedConnectionGeneration &&
            studyStatusRequestRef.current === requestId
          ) {
            commitStudyStatus(reconciled);
          }
        } catch {
          // Keep the last authoritative status when reconciliation also fails.
        }

        if (
          mountedRef.current &&
          joinedRef.current &&
          connectionGenerationRef.current === expectedConnectionGeneration &&
          studyStatusRequestRef.current === requestId
        ) {
          setStudyStatusError(message);
        }
        return false;
      } finally {
        if (studyActionPendingRef.current === pendingAction) {
          const refreshQueued = studyStatusRefreshQueuedRef.current;
          studyStatusRefreshQueuedRef.current = false;
          studyActionPendingRef.current = null;
          if (mountedRef.current) setStudyActionPending(null);
          if (
            (actionSucceeded || refreshQueued) &&
            mountedRef.current &&
            joinedRef.current &&
            connectionGenerationRef.current === expectedConnectionGeneration
          ) {
            // A schedule or LiveKit transition can supersede the POST response
            // immediately. Always reconcile once; queued events make this
            // especially important.
            void loadStudyStatus(false, expectedConnectionGeneration);
          }
        }
      }
    },
    [commitStudyStatus, loadStudyStatus],
  );

  const startStudyBreak = useCallback(
    async () =>
      await runStudyAction(
        "BREAK",
        async (expectedConnectionGeneration) => {
          const { room, track } = requireCurrentStudyCamera(
            expectedConnectionGeneration,
          );
          let status: StudyTimeStatus | null = null;
          let breakRequestError: unknown = null;
          try {
            status = await startMyStudyBreak();
          } catch (requestError) {
            breakRequestError = requestError;
          }
          requireCurrentStudyCamera(expectedConnectionGeneration, track, room);

          if (
            !isConfirmedStudyBreak(status) &&
            !(status && isConfirmedStudyResume(status))
          ) {
            try {
              status = await getMyStudyTimeStatus();
            } catch {
              status = null;
            }
            requireCurrentStudyCamera(
              expectedConnectionGeneration,
              track,
              room,
            );
          }

          if (status && isConfirmedStudyResume(status)) {
            throw breakRequestError instanceof Error
              ? breakRequestError
              : new Error("휴식 상태로 변경되지 않았습니다.");
          }
          if (!status || !isConfirmedStudyBreak(status)) {
            return await failClosedStudyCamera(
              expectedConnectionGeneration,
              track,
              room,
              "공부 기록의 휴식 상태를 확인하지 못해 작업실 연결을 종료했습니다. 다시 입장해 주세요.",
              true,
            );
          }

          try {
            await track.mute();
          } catch {
            requireCurrentStudyCamera(
              expectedConnectionGeneration,
              track,
              room,
            );
            if (track.isMuted) {
              commitCameraPausedForBreak(true, expectedConnectionGeneration);
              return status;
            }

            try {
              await resumeStudyWithVerifiedCamera(
                expectedConnectionGeneration,
                track,
                room,
              );
            } catch {
              return await failClosedStudyCamera(
                expectedConnectionGeneration,
                track,
                room,
                "카메라 상태와 공부 기록을 함께 복구하지 못해 작업실 연결을 종료했습니다. 다시 입장해 주세요.",
                false,
              );
            }
            requireCurrentStudyCamera(
              expectedConnectionGeneration,
              track,
              room,
            );
            commitCameraPausedForBreak(false, expectedConnectionGeneration);
            throw new Error(
              "카메라를 끄지 못해 휴식을 시작하지 못했습니다. 다시 시도해 주세요.",
            );
          }

          requireCurrentStudyCamera(expectedConnectionGeneration, track, room);
          commitCameraPausedForBreak(true, expectedConnectionGeneration);
          return status;
        },
        "휴식 상태로 변경하지 못했습니다.",
      ),
    [
      commitCameraPausedForBreak,
      failClosedStudyCamera,
      requireCurrentStudyCamera,
      resumeStudyWithVerifiedCamera,
      runStudyAction,
    ],
  );

  const resumeStudy = useCallback(
    async () =>
      await runStudyAction(
        "RESUME",
        async (expectedConnectionGeneration) => {
          const { room, track } = requireCurrentStudyCamera(
            expectedConnectionGeneration,
          );
          const wasTrackMuted = track.isMuted;

          if (wasTrackMuted) {
            try {
              await track.unmute();
            } catch {
              requireCurrentStudyCamera(
                expectedConnectionGeneration,
                track,
                room,
              );
              if (track.isMuted) {
                throw new Error(
                  "카메라를 켜지 못했습니다. 카메라 권한을 확인해 주세요.",
                );
              }
            }
          }

          requireCurrentStudyCamera(expectedConnectionGeneration, track, room);

          try {
            const status = await resumeStudyWithVerifiedCamera(
              expectedConnectionGeneration,
              track,
              room,
            );
            commitCameraPausedForBreak(false, expectedConnectionGeneration);
            return status;
          } catch (requestError) {
            requireCurrentStudyCamera(
              expectedConnectionGeneration,
              track,
              room,
            );
            if (!wasTrackMuted) {
              commitCameraPausedForBreak(false, expectedConnectionGeneration);
              throw requestError;
            }
            try {
              await track.mute();
            } catch {
              // The mute flag below decides whether privacy was restored.
            }
            requireCurrentStudyCamera(
              expectedConnectionGeneration,
              track,
              room,
            );
            if (!track.isMuted) {
              return await failClosedStudyCamera(
                expectedConnectionGeneration,
                track,
                room,
                "카메라를 안전하게 다시 끄지 못해 작업실 연결을 종료했습니다. 다시 입장해 주세요.",
                true,
              );
            }
            commitCameraPausedForBreak(true, expectedConnectionGeneration);
            const backendBreakConfirmed = await confirmBackendStudyBreak(
              expectedConnectionGeneration,
              track,
              room,
            );
            if (!backendBreakConfirmed) {
              return await failClosedStudyCamera(
                expectedConnectionGeneration,
                track,
                room,
                "공부 기록의 휴식 상태를 확인하지 못해 작업실 연결을 종료했습니다. 다시 입장해 주세요.",
                false,
              );
            }
            throw requestError;
          }
        },
        "공부 상태로 돌아가지 못했습니다.",
      ),
    [
      commitCameraPausedForBreak,
      confirmBackendStudyBreak,
      failClosedStudyCamera,
      requireCurrentStudyCamera,
      resumeStudyWithVerifiedCamera,
      runStudyAction,
    ],
  );

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
      const visible = visibleRemoteUserIdsRef.current;

      room.remoteParticipants.forEach((participant) => {
        const shouldSubscribe = visible.has(participant.identity);
        participant.trackPublications.forEach((publication) => {
          const isCameraVideo =
            String(publication.kind) === "video" &&
            String(publication.source) === "camera";
          if (isCameraVideo && publication.isDesired !== shouldSubscribe) {
            publication.setSubscribed(shouldSubscribe);
          }
        });
      });
    },
    [],
  );

  const setVisibleRemoteUserIds = useCallback(
    (userIds: string[]) => {
      if (visibleRemoteClearTimerRef.current !== null) {
        window.clearTimeout(visibleRemoteClearTimerRef.current);
        visibleRemoteClearTimerRef.current = null;
      }

      const next = new Set(userIds);
      const applyVisibleRemoteUserIds = () => {
        const current = visibleRemoteUserIdsRef.current;
        const unchanged =
          current.size === next.size &&
          [...next].every((userId) => current.has(userId));
        if (unchanged) return;

        visibleRemoteUserIdsRef.current = next;
        syncRemoteCameraSubscriptions();
      };

      if (next.size === 0) {
        if (visibleRemoteUserIdsRef.current.size === 0) return;

        visibleRemoteClearTimerRef.current = window.setTimeout(() => {
          visibleRemoteClearTimerRef.current = null;
          applyVisibleRemoteUserIds();
        }, 0);
        return;
      }

      applyVisibleRemoteUserIds();
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

  const stopLocalCamera = useCallback((): Promise<void> => {
    if (cameraCleanupPromiseRef.current) {
      return cameraCleanupPromiseRef.current;
    }

    const track = localVideoTrackRef.current;

    localVideoTrackRef.current = null;
    resetCameraPausedForBreak();
    setLocalVideoTrack(null);
    setCameraReady(false);
    setSelectedEffect("original");
    setEffectSupport(createInitialEffectSupport());
    setEffectLoading(false);
    setEffectError("");
    faceEffectProcessorRef.current = null;

    const cleanup = (async () => {
      if (!track) return;

      try {
        if (track.getProcessor()) await track.stopProcessor(false);
      } catch {
        // The camera track still has to stop when processor cleanup fails.
      } finally {
        try {
          track.stop();
        } catch {
          // The browser may already have ended the source track.
        }
      }
    })();
    cameraCleanupPromiseRef.current = cleanup;
    pendingCameraCleanup = cleanup;

    void cleanup.finally(() => {
      if (cameraCleanupPromiseRef.current === cleanup) {
        cameraCleanupPromiseRef.current = null;
      }
      if (pendingCameraCleanup === cleanup) pendingCameraCleanup = null;
    });
    return cleanup;
  }, [resetCameraPausedForBreak]);

  const startLocalCamera = useCallback(
    async (deviceId?: string, connectionGeneration?: number) => {
      const cleanup = pendingCameraCleanup;
      if (cleanup) await cleanup;

      const isCurrentGeneration = () =>
        connectionGeneration === undefined ||
        connectionGenerationRef.current === connectionGeneration;

      if (!isCurrentGeneration()) {
        throw new WorkroomConnectionCancelledError();
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("이 브라우저에서는 카메라를 사용할 수 없습니다.");
      }

      const currentTrack = localVideoTrackRef.current;
      if (currentTrack) {
        if (deviceId) {
          const currentDeviceId = await currentTrack.getDeviceId();
          if (!isCurrentGeneration()) {
            throw new WorkroomConnectionCancelledError();
          }
          if (currentDeviceId !== deviceId) {
            const changed = await currentTrack.setDeviceId(deviceId);
            if (!isCurrentGeneration()) {
              throw new WorkroomConnectionCancelledError();
            }
            if (!changed) {
              throw new Error("선택한 카메라로 변경하지 못했습니다.");
            }
          }
        }

        setCameraReady(true);
        await refreshDevices();
        if (!isCurrentGeneration()) {
          throw new WorkroomConnectionCancelledError();
        }
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
      let adopted = false;

      try {
        if (!isCurrentGeneration()) {
          throw new WorkroomConnectionCancelledError();
        }

        const activeDeviceId = (await track.getDeviceId()) ?? deviceId ?? "";
        if (!isCurrentGeneration()) {
          throw new WorkroomConnectionCancelledError();
        }

        localVideoTrackRef.current = track;
        adopted = true;
        resetCameraPausedForBreak();
        setLocalVideoTrack(track);
        setCameraReady(true);
        setSelectedDeviceId(activeDeviceId);
        await refreshDevices();
        if (!isCurrentGeneration()) {
          if (localVideoTrackRef.current === track) {
            localVideoTrackRef.current = null;
            setLocalVideoTrack(null);
            setCameraReady(false);
            track.stop();
          }
          throw new WorkroomConnectionCancelledError();
        }
        return track;
      } finally {
        if (!adopted) track.stop();
      }
    },
    [refreshDevices, resetCameraPausedForBreak],
  );

  const disconnectLiveKit = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    participantSidRef.current = null;
    resetCameraPausedForBreak();
    setRemoteVideos([]);

    if (!room) return;

    try {
      await room.disconnect();
    } catch {
      // The LiveKit webhook or server timeout still reconciles this participant.
    }
  }, [resetCameraPausedForBreak]);

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
        faceEffectProcessorRef.current = null;
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

        await waitForStableCameraDimensions(track);
        const processor = BackgroundBlur(10, undefined, undefined, {
          maxFps: supportsModernBackgroundProcessors() ? 24 : 18,
        });
        await track.setProcessor(processor, true);
        faceEffectProcessorRef.current = null;
        setEffectSupport((current) => ({
          ...current,
          "background-blur": "supported",
        }));
        setSelectedEffect("background-blur");
        return;
      }

      if (isFaceEffect(effect)) {
        const { createFaceEffectProcessor, supportsFaceEffect } =
          await import("../utils/landmarker-effect-processor");

        if (!supportsFaceEffect()) {
          setEffectSupport((current) => ({
            ...current,
            [effect]: "unsupported",
          }));
          setEffectError("이 기기에서는 이 화면 효과를 지원하지 않습니다.");
          return;
        }

        const currentProcessor = track.getProcessor();
        const reusableProcessor = faceEffectProcessorRef.current;

        if (reusableProcessor && currentProcessor === reusableProcessor) {
          await reusableProcessor.updateTransformerOptions({
            variant: effect,
          });
        } else {
          await waitForStableCameraDimensions(track);
          const processor = createFaceEffectProcessor(effect);
          await track.setProcessor(processor, true);
          faceEffectProcessorRef.current = processor;
        }

        setEffectSupport((current) => ({
          ...current,
          [effect]: "supported",
        }));
        setSelectedEffect(effect);
        return;
      }
    } catch {
      try {
        if (track.getProcessor()) await track.stopProcessor(false);
      } catch {
        // Keep the original camera usable even if processor cleanup fails.
      }
      faceEffectProcessorRef.current = null;
      setSelectedEffect("original");
      const label =
        effect === "background-blur"
          ? "배경 흐림"
          : isFaceEffect(effect)
            ? FACE_EFFECT_LABELS[effect]
            : "화면";
      setEffectError(
        `${label} 효과를 준비하지 못했습니다. 원본을 다시 선택해 주세요.`,
      );
    } finally {
      setEffectLoading(false);
    }
  }, []);

  const connectLiveKit = useCallback(
    async (token: CamTokenDto, connectionGeneration: number) => {
      if (!token.url || token.token.startsWith("stub.")) {
        throw new Error("실시간 작업장 서버가 설정되지 않았습니다.");
      }
      if (!token.canPublish) {
        throw new Error("이 계정에는 카메라 송출 권한이 없습니다.");
      }
      if (connectionGenerationRef.current !== connectionGeneration) {
        throw new WorkroomConnectionCancelledError();
      }

      const { Room, RoomEvent, Track } = await import("livekit-client");
      if (connectionGenerationRef.current !== connectionGeneration) {
        throw new WorkroomConnectionCancelledError();
      }

      const videoTrack = localVideoTrackRef.current;
      if (!videoTrack) {
        throw new Error("송출할 카메라 화면을 찾지 못했습니다.");
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const isCurrentRoom = () =>
        connectionGenerationRef.current === connectionGeneration &&
        roomRef.current === room;

      try {
        room.on(
          RoomEvent.TrackSubscribed,
          (track, publication, participant) => {
            if (
              !isCurrentRoom() ||
              String(track.kind) !== "video" ||
              String(publication.source) !== "camera"
            ) {
              return;
            }
            setRemoteVideos((current) => [
              ...current.filter(
                (video) => video.trackSid !== publication.trackSid,
              ),
              {
                trackSid: publication.trackSid,
                userId: participant.identity,
                track: track as RemoteVideoTrack,
                muted: publication.isMuted || track.isMuted,
              },
            ]);
          },
        );

        room.on(RoomEvent.TrackMuted, (publication, participant) => {
          if (
            !isCurrentRoom() ||
            participant.identity === room.localParticipant.identity ||
            String(publication.kind) !== "video" ||
            String(publication.source) !== "camera"
          ) {
            return;
          }

          setRemoteVideos((current) =>
            current.map((video) =>
              video.trackSid === publication.trackSid
                ? { ...video, muted: true }
                : video,
            ),
          );
        });

        room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
          if (
            !isCurrentRoom() ||
            participant.identity === room.localParticipant.identity ||
            String(publication.kind) !== "video" ||
            String(publication.source) !== "camera"
          ) {
            return;
          }

          setRemoteVideos((current) => {
            if (
              current.some((video) => video.trackSid === publication.trackSid)
            ) {
              return current.map((video) =>
                video.trackSid === publication.trackSid
                  ? { ...video, muted: false }
                  : video,
              );
            }

            const track = publication.track;
            if (!track || String(track.kind) !== "video") return current;
            return [
              ...current,
              {
                trackSid: publication.trackSid,
                userId: participant.identity,
                track: track as RemoteVideoTrack,
                muted: false,
              },
            ];
          });
        });

        room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
          if (!isCurrentRoom()) return;
          setRemoteVideos((current) =>
            current.filter((video) => video.trackSid !== publication.trackSid),
          );
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (!isCurrentRoom()) return;
          setRemoteVideos((current) =>
            current.filter((video) => video.userId !== participant.identity),
          );
        });

        room.on(RoomEvent.TrackPublished, () => {
          if (!isCurrentRoom()) return;
          syncRemoteCameraSubscriptions(room);
        });

        room.on(RoomEvent.Disconnected, () => {
          if (roomRef.current !== room) return;

          const participantSid = participantSidRef.current;
          connectionGenerationRef.current += 1;
          roomRef.current = null;
          participantSidRef.current = null;
          joinedRef.current = false;
          joiningRef.current = false;
          leavingRef.current = false;
          resetCameraPausedForBreak();
          setJoined(false);
          setJoining(false);
          setRemoteVideos([]);
          resetStudyStatus();
          resetAttendanceSync();
          setError(
            "실시간 작업장 연결이 종료되었습니다. 카메라를 확인한 뒤 다시 입장해 주세요.",
          );
          void stopLocalCamera();
          if (participantSid) {
            void leaveCam({ participantSid })
              .catch(() => undefined)
              .finally(() => void refreshRoomMembers());
          } else {
            void refreshRoomMembers();
          }
        });

        await room.connect(token.url, token.token, { autoSubscribe: false });
        if (!isCurrentRoom()) {
          throw new WorkroomConnectionCancelledError();
        }

        const participantSid = room.localParticipant.sid;
        if (!participantSid) {
          throw new Error("작업장 참가자 연결 정보를 확인하지 못했습니다.");
        }
        participantSidRef.current = participantSid;
        syncRemoteCameraSubscriptions(room);

        await room.localParticipant.publishTrack(videoTrack, {
          source: Track.Source.Camera,
        });
        if (!isCurrentRoom()) {
          throw new WorkroomConnectionCancelledError();
        }
        commitCameraPausedForBreak(false, connectionGeneration);
        return participantSid;
      } catch (err) {
        if (roomRef.current === room) roomRef.current = null;
        try {
          await room.disconnect();
        } catch {
          // Preserve the original connection or publishing error.
        }
        throw err;
      }
    },
    [
      commitCameraPausedForBreak,
      refreshRoomMembers,
      resetAttendanceSync,
      resetCameraPausedForBreak,
      resetStudyStatus,
      stopLocalCamera,
      syncRemoteCameraSubscriptions,
    ],
  );

  const leaveSession = useCallback((): Promise<void> => {
    if (leaveSessionPromiseRef.current) {
      return leaveSessionPromiseRef.current;
    }

    const leavePromise = (async () => {
      const participantSid = participantSidRef.current;
      const leaveGeneration = connectionGenerationRef.current + 1;
      connectionGenerationRef.current = leaveGeneration;
      leavingRef.current = true;
      joiningRef.current = true;
      joinedRef.current = false;
      participantSidRef.current = null;
      setJoining(true);
      setJoined(false);
      setError("");
      resetStudyStatus();
      resetAttendanceSync();

      try {
        await disconnectLiveKit();
        await stopLocalCamera();

        if (participantSid) {
          void leaveCam({ participantSid })
            .catch(() => undefined)
            .finally(() => void refreshRoomMembers());
        } else {
          void refreshRoomMembers();
        }
      } finally {
        leavingRef.current = false;
        if (connectionGenerationRef.current === leaveGeneration) {
          joiningRef.current = false;
          if (mountedRef.current) setJoining(false);
        }
      }
    })();
    leaveSessionPromiseRef.current = leavePromise;
    void leavePromise.finally(() => {
      if (leaveSessionPromiseRef.current === leavePromise) {
        leaveSessionPromiseRef.current = null;
      }
    });
    return leavePromise;
  }, [
    disconnectLiveKit,
    refreshRoomMembers,
    resetAttendanceSync,
    resetStudyStatus,
    stopLocalCamera,
  ]);

  const previewCamera = useCallback(
    async (deviceId?: string) => {
      setError("");
      if (joiningRef.current) return;
      const connectionGeneration = connectionGenerationRef.current;
      joiningRef.current = true;
      setJoining(true);
      try {
        await startLocalCamera(
          deviceId ?? (selectedDeviceId || undefined),
          connectionGeneration,
        );
      } catch (err) {
        if (err instanceof WorkroomConnectionCancelledError) return;
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
      const connectionGeneration = connectionGenerationRef.current;
      setSelectedDeviceId(deviceId);
      setError("");
      try {
        await startLocalCamera(deviceId || undefined, connectionGeneration);
      } catch (err) {
        if (err instanceof WorkroomConnectionCancelledError) return;
        const message =
          err instanceof Error ? err.message : "카메라를 변경하지 못했습니다.";

        if (joinedRef.current) await leaveSession();
        else await stopLocalCamera();
        setError(`${message} 카메라 미리보기를 다시 확인해 주세요.`);
      }
    },
    [leaveSession, startLocalCamera, stopLocalCamera],
  );

  const startSession = useCallback(
    async (slot?: number) => {
      if (joinedRef.current) return true;
      if (joiningRef.current || leavingRef.current) return false;

      const connectionGeneration = connectionGenerationRef.current + 1;
      connectionGenerationRef.current = connectionGeneration;
      resetCameraPausedForBreak();
      setError("");
      joiningRef.current = true;
      setJoining(true);
      resetStudyStatus();
      resetAttendanceSync();
      syncAttendanceSlot(slot);
      try {
        const token = await issueCamToken();
        if (connectionGenerationRef.current !== connectionGeneration) {
          throw new WorkroomConnectionCancelledError();
        }
        if (
          localVideoTrackRef.current &&
          localVideoTrackRef.current.mediaStreamTrack.readyState !== "live"
        ) {
          await stopLocalCamera();
        }
        if (!localVideoTrackRef.current) {
          await startLocalCamera(
            selectedDeviceId || undefined,
            connectionGeneration,
          );
        }
        const participantSid = await connectLiveKit(
          token,
          connectionGeneration,
        );
        if (
          connectionGenerationRef.current !== connectionGeneration ||
          participantSidRef.current !== participantSid
        ) {
          throw new WorkroomConnectionCancelledError();
        }
        joinedRef.current = true;
        setJoined(true);
        flushAttendanceSync();
        await refreshRoomMembers();
        return connectionGenerationRef.current === connectionGeneration;
      } catch (err) {
        if (connectionGenerationRef.current !== connectionGeneration) {
          return false;
        }

        await disconnectLiveKit();
        await stopLocalCamera();
        joinedRef.current = false;
        participantSidRef.current = null;
        setJoined(false);
        resetStudyStatus();
        resetAttendanceSync();
        if (!(err instanceof WorkroomConnectionCancelledError)) {
          setError(
            err instanceof Error
              ? err.message
              : "작업장 연결을 시작하지 못했습니다.",
          );
        }
        return false;
      } finally {
        if (connectionGenerationRef.current === connectionGeneration) {
          joiningRef.current = false;
          setJoining(false);
        }
      }
    },
    [
      connectLiveKit,
      disconnectLiveKit,
      flushAttendanceSync,
      refreshRoomMembers,
      resetAttendanceSync,
      resetCameraPausedForBreak,
      resetStudyStatus,
      selectedDeviceId,
      startLocalCamera,
      stopLocalCamera,
      syncAttendanceSlot,
    ],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (visibleRemoteClearTimerRef.current !== null) {
        window.clearTimeout(visibleRemoteClearTimerRef.current);
        visibleRemoteClearTimerRef.current = null;
      }
      studyStatusRequestRef.current += 1;
      resetAttendanceSync();
    };
  }, [resetAttendanceSync]);

  useEffect(() => {
    if (!joined) return;

    const expectedConnectionGeneration = connectionGenerationRef.current;
    let cancelled = false;
    let retryIndex = 0;
    let retryTimer: number | null = null;

    const finishStartupSync = () => {
      if (cancelled || !mountedRef.current) return;
      setStudyStatusLoading(false);
    };

    const syncUntilReady = async () => {
      if (
        cancelled ||
        !joinedRef.current ||
        connectionGenerationRef.current !== expectedConnectionGeneration
      ) {
        return;
      }

      if (retryIndex === 0 && mountedRef.current) {
        setStudyStatusLoading(true);
        setStudyStatusError("");
      }

      const status = await loadStudyStatus(false, expectedConnectionGeneration);
      if (cancelled) return;

      if (status?.active && status.state && status.source) {
        finishStartupSync();
        return;
      }

      retryIndex += 1;
      if (retryIndex < STUDY_STATUS_STARTUP_RETRY_MS.length) {
        retryTimer = window.setTimeout(
          () => void syncUntilReady(),
          STUDY_STATUS_STARTUP_RETRY_MS[retryIndex],
        );
        return;
      }

      // A valid inactive response means the LiveKit webhook has not opened the
      // authoritative study session yet. Keep that as a neutral waiting state;
      // request failures already retain their concrete error above.
      finishStartupSync();
    };

    retryTimer = window.setTimeout(
      () => void syncUntilReady(),
      STUDY_STATUS_STARTUP_RETRY_MS[0],
    );
    let refreshTimer: number | null = null;
    const scheduleBoundaryRefresh = () => {
      if (cancelled) return;
      const now = Date.now();
      const delay =
        STUDY_STATUS_REFRESH_INTERVAL_MS -
        (now % STUDY_STATUS_REFRESH_INTERVAL_MS) +
        STUDY_STATUS_BOUNDARY_OFFSET_MS;
      refreshTimer = window.setTimeout(() => {
        if (cancelled) return;
        void loadStudyStatus(false, expectedConnectionGeneration);
        scheduleBoundaryRefresh();
      }, delay);
    };
    scheduleBoundaryRefresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void loadStudyStatus(false, expectedConnectionGeneration);
    };
    const refreshWhenFocused = () => {
      void loadStudyStatus(false, expectedConnectionGeneration);
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenFocused);

    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenFocused);
      studyStatusRequestRef.current += 1;
    };
  }, [joined, loadStudyStatus]);

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

    type CameraPresencePayload = {
      userId?: string;
      liveKitParticipantSid?: string | null;
    };
    type BellPayload = {
      type?: string;
      slot?: number;
    };

    const isCurrentLocalMember = (payload?: CameraPresencePayload) => {
      const localIdentity = roomRef.current?.localParticipant.identity;
      return Boolean(
        payload?.userId && localIdentity && payload.userId === localIdentity,
      );
    };
    const isCurrentLocalJoin = (payload?: CameraPresencePayload) => {
      const localParticipantSid = participantSidRef.current;
      return Boolean(
        isCurrentLocalMember(payload) &&
        payload?.liveKitParticipantSid &&
        localParticipantSid &&
        payload.liveKitParticipantSid === localParticipantSid,
      );
    };
    const refreshJoinedPresence = (payload?: CameraPresencePayload) => {
      void refreshRoomMembers();
      if (!isCurrentLocalJoin(payload)) return;

      const expectedConnectionGeneration = connectionGenerationRef.current;
      setAttendanceBindingReady(true, expectedConnectionGeneration);
      if (joinedRef.current) {
        void loadStudyStatus(false, expectedConnectionGeneration);
      }
    };
    const refreshLeftPresence = (payload?: CameraPresencePayload) => {
      void refreshRoomMembers();
      if (!isCurrentLocalMember(payload)) return;

      setAttendanceBindingReady(false);
      if (joinedRef.current) void loadStudyStatus(false);
    };
    const refreshForSchedule = (payload?: BellPayload) => {
      if (!joinedRef.current) return;

      if (payload?.type === "periodStart") {
        // The server bell is authoritative at slot boundaries. Force one
        // fresh sync even if the browser clock reached this slot first and a
        // previous 2xx response represented a server-side no-op.
        syncAttendanceSlot(payload.slot, true);
      } else if (payload?.type === "breakStart") {
        syncAttendanceSlot();
      }
      void loadStudyStatus(false);
    };

    socket.on("cam:join", refreshJoinedPresence);
    socket.on("cam:leave", refreshLeftPresence);
    socket.on("bell", refreshForSchedule);
    socket.on("connect", refreshForSchedule);
    return () => {
      socket.off("cam:join", refreshJoinedPresence);
      socket.off("cam:leave", refreshLeftPresence);
      socket.off("bell", refreshForSchedule);
      socket.off("connect", refreshForSchedule);
    };
  }, [
    loadStudyStatus,
    refreshRoomMembers,
    setAttendanceBindingReady,
    socket,
    syncAttendanceSlot,
  ]);

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
        cameraPausedForBreak,
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
        studyStatus,
        studyStatusLoading,
        studyStatusError,
        studyActionPending,
        previewCamera,
        selectCamera,
        selectCameraEffect,
        startSession,
        leaveSession,
        syncAttendanceSlot,
        refreshStudyStatus,
        startStudyBreak,
        resumeStudy,
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
