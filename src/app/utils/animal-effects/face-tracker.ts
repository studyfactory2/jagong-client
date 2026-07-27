import {
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { AdaptiveQualityProfile } from "./adaptive-quality";
import {
  CHIN,
  FOREHEAD,
  LEFT_CHEEK,
  LEFT_EYE,
  NOSE_TIP,
  RIGHT_CHEEK,
  RIGHT_EYE,
  averageLandmarkPoint,
  landmarkPoint,
} from "./landmark-utils";
import type {
  DrawingContext,
  EffectCanvas,
  FacePose,
  Point,
  TrackingResult,
} from "./types";

const TASKS_VISION_WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const LOST_FACE_GRACE_MS = 160;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

export class FaceTracker {
  private detector: FaceLandmarker | null = null;
  private detectionCanvas: EffectCanvas | null = null;
  private detectionContext: DrawingContext | null = null;
  private lastLandmarks: NormalizedLandmark[] | null = null;
  private smoothedPose: FacePose | null = null;
  private lastDetectionRun = 0;
  private lastFaceSeen = 0;
  private lastTimestamp = 0;

  async init() {
    const vision = await FilesetResolver.forVisionTasks(TASKS_VISION_WASM_ROOT);
    this.detector = await this.createDetector(vision);
  }

  track(
    source: CanvasImageSource,
    outputWidth: number,
    outputHeight: number,
    profile: AdaptiveQualityProfile,
  ): TrackingResult | null {
    const now = performance.now();
    const detectionInterval =
      outputWidth <= 640
        ? profile.detectionIntervalCompactMs
        : profile.detectionIntervalDesktopMs;

    if (
      this.detector &&
      (this.lastDetectionRun === 0 ||
        now - this.lastDetectionRun >= detectionInterval)
    ) {
      this.ensureDetectionCanvas(
        outputWidth,
        outputHeight,
        profile.detectionMaxEdge,
      );
      this.lastDetectionRun = now;
      const detectionCanvas = this.detectionCanvas;
      const detectionContext = this.detectionContext;

      if (detectionCanvas && detectionContext) {
        detectionContext.drawImage(
          source,
          0,
          0,
          detectionCanvas.width,
          detectionCanvas.height,
        );

        const timestamp = Math.max(now, this.lastTimestamp + 1);
        this.lastTimestamp = timestamp;
        const result = this.detector.detectForVideo(detectionCanvas, timestamp);
        const face = result.faceLandmarks?.[0];

        if (face?.length) {
          const currentPose = this.calculatePose(
            face,
            outputWidth,
            outputHeight,
          );
          this.smoothedPose = this.smoothPose(currentPose);
          this.lastLandmarks = face;
          this.lastFaceSeen = now;
        }
      }
    }

    if (
      this.smoothedPose &&
      this.lastLandmarks &&
      now - this.lastFaceSeen <= LOST_FACE_GRACE_MS
    ) {
      return {
        landmarks: this.lastLandmarks,
        pose: this.smoothedPose,
      };
    }

    this.lastLandmarks = null;
    this.smoothedPose = null;
    return null;
  }

  reset() {
    this.lastLandmarks = null;
    this.smoothedPose = null;
    this.lastDetectionRun = 0;
    this.lastFaceSeen = 0;
    this.lastTimestamp = 0;
  }

  destroy() {
    this.detector?.close();
    this.detector = null;
    this.detectionCanvas = null;
    this.detectionContext = null;
    this.reset();
  }

  private async createDetector(
    vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  ) {
    const options = {
      runningMode: "VIDEO" as const,
      numFaces: 1,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    };

    try {
      return await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL,
          delegate: "GPU",
        },
        ...options,
      });
    } catch {
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL,
          delegate: "CPU",
        },
        ...options,
      });
    }
  }

  private ensureDetectionCanvas(
    outputWidth: number,
    outputHeight: number,
    maxEdge: number,
  ) {
    const longestEdge = Math.max(outputWidth, outputHeight);
    const detectionScale = Math.min(
      1,
      maxEdge / Math.max(1, longestEdge),
    );
    const detectionWidth = Math.max(
      1,
      Math.round(outputWidth * detectionScale),
    );
    const detectionHeight = Math.max(
      1,
      Math.round(outputHeight * detectionScale),
    );

    if (!this.detectionCanvas) {
      this.detectionCanvas = this.createCanvas(
        detectionWidth,
        detectionHeight,
      );
      this.detectionContext = this.detectionCanvas.getContext(
        "2d",
      ) as DrawingContext | null;
    } else if (
      this.detectionCanvas.width !== detectionWidth ||
      this.detectionCanvas.height !== detectionHeight
    ) {
      this.detectionCanvas.width = detectionWidth;
      this.detectionCanvas.height = detectionHeight;
    }

    if (!this.detectionContext) {
      throw new Error("Animal effect detection canvas is unavailable.");
    }
  }

  private createCanvas(width: number, height: number): EffectCanvas {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private calculatePose(
    landmarks: NormalizedLandmark[],
    outputWidth: number,
    outputHeight: number,
  ): FacePose {
    const point = (index: number) =>
      landmarkPoint(landmarks, index, outputWidth, outputHeight);
    const averagePoint = (indices: number[]) =>
      averageLandmarkPoint(
        landmarks,
        indices,
        outputWidth,
        outputHeight,
      );
    const leftCheek = point(LEFT_CHEEK);
    const rightCheek = point(RIGHT_CHEEK);
    const forehead = point(FOREHEAD);
    const chin = point(CHIN);
    const nose = point(NOSE_TIP);
    const leftEye = averagePoint(LEFT_EYE);
    const rightEye = averagePoint(RIGHT_EYE);
    const width = Math.max(1, distance(leftCheek, rightCheek));
    const height = Math.max(1, distance(forehead, chin));
    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const leftNoseSpan = distance(leftCheek, nose);
    const rightNoseSpan = distance(nose, rightCheek);
    const yaw = clamp(
      ((leftNoseSpan - rightNoseSpan) /
        Math.max(1, leftNoseSpan + rightNoseSpan)) *
        2.35,
      -0.72,
      0.72,
    );
    const down = {
      x: -Math.sin(roll),
      y: Math.cos(roll),
    };
    const noseFromForehead =
      (nose.x - forehead.x) * down.x + (nose.y - forehead.y) * down.y;
    const pitch = clamp((noseFromForehead / height - 0.52) * 2.6, -0.65, 0.65);

    return {
      foreheadX: forehead.x,
      foreheadY: forehead.y,
      centerX: (forehead.x + chin.x) / 2,
      centerY: (forehead.y + chin.y) / 2,
      noseX: nose.x,
      noseY: nose.y,
      width,
      height,
      roll,
      yaw,
      pitch,
    };
  }

  private smoothPose(current: FacePose): FacePose {
    const previous = this.smoothedPose;
    if (!previous) return current;

    const centerMotion =
      Math.hypot(
        current.noseX - previous.noseX,
        current.noseY - previous.noseY,
      ) / Math.max(1, previous.width);
    const scaleMotion =
      Math.abs(current.width - previous.width) / Math.max(1, previous.width);
    const rotationMotion = Math.abs(angleDelta(previous.roll, current.roll));
    const motion =
      centerMotion * 2.4 + scaleMotion * 1.8 + rotationMotion * 1.2;
    const amount = clamp(0.34 + motion, 0.34, 0.82);

    return {
      foreheadX: mix(previous.foreheadX, current.foreheadX, amount),
      foreheadY: mix(previous.foreheadY, current.foreheadY, amount),
      centerX: mix(previous.centerX, current.centerX, amount),
      centerY: mix(previous.centerY, current.centerY, amount),
      noseX: mix(previous.noseX, current.noseX, amount),
      noseY: mix(previous.noseY, current.noseY, amount),
      width: mix(previous.width, current.width, amount),
      height: mix(previous.height, current.height, amount),
      roll: previous.roll + angleDelta(previous.roll, current.roll) * amount,
      yaw: mix(previous.yaw, current.yaw, amount),
      pitch: mix(previous.pitch, current.pitch, amount),
    };
  }
}
