import {
  ProcessorWrapper,
  type VideoTrackTransformer,
  type VideoTransformerInitOptions,
} from "@livekit/track-processors";
import {
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const TASKS_VISION_WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const DETECTION_CANVAS_MAX_EDGE = 384;
const DETECTION_INTERVAL_DESKTOP_MS = 58;
const DETECTION_INTERVAL_COMPACT_MS = 72;
const LOST_FACE_GRACE_MS = 160;

export type AnimalEffectVariant = "cat" | "dog" | "bear" | "bunny" | "fox";

export type AnimalEffectOptions = {
  variant: AnimalEffectVariant;
};

type DrawingContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

type Point = {
  x: number;
  y: number;
};

type FacePose = {
  foreheadX: number;
  foreheadY: number;
  noseX: number;
  noseY: number;
  width: number;
  height: number;
  roll: number;
  yaw: number;
  pitch: number;
};

type TrackingResult = {
  landmarks: NormalizedLandmark[];
  pose: FacePose;
};

type EarKind = "pointed" | "floppy" | "round" | "tall";
type NoseKind = "triangle" | "oval";

type AnimalConfig = {
  ear: EarKind;
  noseKind: NoseKind;
  outer: string;
  inner: string;
  nose: string;
  muzzle: string;
  accent: string;
  earScale: number;
  earSpread: number;
  earLift: number;
  earTilt: number;
  noseScale: number;
  whiskers: boolean;
  cheekMarks: boolean;
};

const ANIMALS: Record<AnimalEffectVariant, AnimalConfig> = {
  cat: {
    ear: "pointed",
    noseKind: "triangle",
    outer: "#17495c",
    inner: "#f48678",
    nose: "#ef7f77",
    muzzle: "rgba(255, 254, 249, 0.72)",
    accent: "#fffef9",
    earScale: 0.28,
    earSpread: 0.34,
    earLift: 0.14,
    earTilt: 0.12,
    noseScale: 0.052,
    whiskers: true,
    cheekMarks: false,
  },
  dog: {
    ear: "floppy",
    noseKind: "oval",
    outer: "#8a5a3c",
    inner: "#d6a889",
    nose: "#2f3032",
    muzzle: "rgba(245, 224, 207, 0.82)",
    accent: "#fff4ea",
    earScale: 0.32,
    earSpread: 0.4,
    earLift: 0.04,
    earTilt: 0.24,
    noseScale: 0.062,
    whiskers: false,
    cheekMarks: false,
  },
  bear: {
    ear: "round",
    noseKind: "oval",
    outer: "#6b4a35",
    inner: "#caa588",
    nose: "#2d2a29",
    muzzle: "rgba(232, 205, 177, 0.84)",
    accent: "#fff6ec",
    earScale: 0.22,
    earSpread: 0.35,
    earLift: 0.13,
    earTilt: 0,
    noseScale: 0.06,
    whiskers: false,
    cheekMarks: false,
  },
  bunny: {
    ear: "tall",
    noseKind: "triangle",
    outer: "#f3f0ee",
    inner: "#f7b8c8",
    nose: "#ed8296",
    muzzle: "rgba(255, 255, 255, 0.76)",
    accent: "#ffffff",
    earScale: 0.34,
    earSpread: 0.22,
    earLift: 0.28,
    earTilt: 0.06,
    noseScale: 0.045,
    whiskers: true,
    cheekMarks: false,
  },
  fox: {
    ear: "pointed",
    noseKind: "triangle",
    outer: "#d9772f",
    inner: "#fff0dc",
    nose: "#2b2c2e",
    muzzle: "rgba(255, 242, 224, 0.78)",
    accent: "#fff7ec",
    earScale: 0.3,
    earSpread: 0.36,
    earLift: 0.15,
    earTilt: 0.14,
    noseScale: 0.052,
    whiskers: true,
    cheekMarks: true,
  },
};

const LEFT_EYE = [
  33, 133, 159, 145, 160, 144, 158, 153, 157, 154, 173, 246, 161, 163,
];
const RIGHT_EYE = [
  362, 263, 386, 374, 385, 373, 387, 380, 384, 381, 398, 466, 388, 390,
];
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const FOREHEAD = 10;
const CHIN = 152;
const NOSE_TIP = 1;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

class AnimalEffectTransformer
  implements VideoTrackTransformer<AnimalEffectOptions>
{
  transformer?: TransformStream<VideoFrame, VideoFrame>;

  private variant: AnimalEffectVariant;
  private detector: FaceLandmarker | null = null;
  private outputCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private outputContext: DrawingContext | null = null;
  private detectionCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private detectionContext: DrawingContext | null = null;
  private overlayCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private overlayContext: DrawingContext | null = null;
  private lastLandmarks: NormalizedLandmark[] | null = null;
  private smoothedPose: FacePose | null = null;
  private lastDetectionRun = 0;
  private lastFaceSeen = 0;
  private lastTimestamp = 0;

  constructor(options: AnimalEffectOptions) {
    this.variant = options.variant;
  }

  async init(options: VideoTransformerInitOptions) {
    this.setOutputCanvas(options.outputCanvas);
    const vision = await FilesetResolver.forVisionTasks(TASKS_VISION_WASM_ROOT);
    this.detector = await this.createDetector(vision);
    this.transformer = new TransformStream<VideoFrame, VideoFrame>({
      transform: (frame, controller) => this.transform(frame, controller),
    });
  }

  restart(options: VideoTransformerInitOptions) {
    this.setOutputCanvas(options.outputCanvas);
    this.resetTracking();
  }

  update(options: AnimalEffectOptions) {
    this.variant = options.variant;
  }

  destroy() {
    this.detector?.close();
    this.detector = null;
    this.outputCanvas = null;
    this.outputContext = null;
    this.detectionCanvas = null;
    this.detectionContext = null;
    this.overlayCanvas = null;
    this.overlayContext = null;
    this.resetTracking();
    this.transformer = undefined;
  }

  transform(
    frame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>,
  ) {
    try {
      const { outputCanvas, outputContext } = this.requireOutput();
      outputContext.drawImage(
        frame,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height,
      );

      try {
        const tracking = this.getTracking();
        if (tracking) this.drawAnimal(tracking);
      } catch {
        // Character effects are decorative. A tracking failure keeps the raw
        // camera usable instead of freezing or publishing an outdated frame.
      }

      this.enqueueOutputFrame(frame, controller);
    } catch {
      // The input frame is still closed below if the output canvas failed.
    } finally {
      frame.close();
    }
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

  private setOutputCanvas(
    outputCanvas: OffscreenCanvas | HTMLCanvasElement,
  ) {
    const context = outputCanvas.getContext("2d", {
      alpha: false,
    }) as DrawingContext | null;
    if (!context) {
      throw new Error("Animal effect output canvas is unavailable.");
    }

    this.outputCanvas = outputCanvas;
    this.outputContext = context;
    this.ensureWorkingCanvases();
  }

  private ensureWorkingCanvases() {
    const { outputCanvas } = this.requireOutput();
    const longestEdge = Math.max(outputCanvas.width, outputCanvas.height);
    const detectionScale = Math.min(
      1,
      DETECTION_CANVAS_MAX_EDGE / Math.max(1, longestEdge),
    );
    const detectionWidth = Math.max(
      1,
      Math.round(outputCanvas.width * detectionScale),
    );
    const detectionHeight = Math.max(
      1,
      Math.round(outputCanvas.height * detectionScale),
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

    if (!this.overlayCanvas) {
      this.overlayCanvas = this.createCanvas(
        outputCanvas.width,
        outputCanvas.height,
      );
      this.overlayContext = this.overlayCanvas.getContext(
        "2d",
      ) as DrawingContext | null;
    } else if (
      this.overlayCanvas.width !== outputCanvas.width ||
      this.overlayCanvas.height !== outputCanvas.height
    ) {
      this.overlayCanvas.width = outputCanvas.width;
      this.overlayCanvas.height = outputCanvas.height;
    }

    if (!this.detectionContext || !this.overlayContext) {
      throw new Error("Animal effect working canvas is unavailable.");
    }
  }

  private createCanvas(
    width: number,
    height: number,
  ): OffscreenCanvas | HTMLCanvasElement {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private getTracking(): TrackingResult | null {
    const { outputCanvas } = this.requireOutput();
    const now = performance.now();
    const detectionInterval =
      outputCanvas.width <= 640
        ? DETECTION_INTERVAL_COMPACT_MS
        : DETECTION_INTERVAL_DESKTOP_MS;

    if (
      this.detector &&
      (this.lastDetectionRun === 0 ||
        now - this.lastDetectionRun >= detectionInterval)
    ) {
      this.lastDetectionRun = now;
      const detectionCanvas = this.detectionCanvas;
      const detectionContext = this.detectionContext;

      if (detectionCanvas && detectionContext) {
        detectionContext.drawImage(
          outputCanvas as CanvasImageSource,
          0,
          0,
          detectionCanvas.width,
          detectionCanvas.height,
        );

        const timestamp = Math.max(now, this.lastTimestamp + 1);
        this.lastTimestamp = timestamp;
        const result = this.detector.detectForVideo(
          detectionCanvas,
          timestamp,
        );
        const face = result.faceLandmarks?.[0];

        if (face?.length) {
          const currentPose = this.calculatePose(face);
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

  private calculatePose(landmarks: NormalizedLandmark[]): FacePose {
    const leftCheek = this.point(landmarks, LEFT_CHEEK);
    const rightCheek = this.point(landmarks, RIGHT_CHEEK);
    const forehead = this.point(landmarks, FOREHEAD);
    const chin = this.point(landmarks, CHIN);
    const nose = this.point(landmarks, NOSE_TIP);
    const leftEye = this.averagePoint(landmarks, LEFT_EYE);
    const rightEye = this.averagePoint(landmarks, RIGHT_EYE);
    const width = Math.max(1, distance(leftCheek, rightCheek));
    const height = Math.max(1, distance(forehead, chin));
    const roll = Math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x,
    );
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
    const rotationMotion = Math.abs(
      angleDelta(previous.roll, current.roll),
    );
    const motion = centerMotion * 2.4 + scaleMotion * 1.8 + rotationMotion * 1.2;
    const amount = clamp(0.34 + motion, 0.34, 0.82);

    return {
      foreheadX: mix(previous.foreheadX, current.foreheadX, amount),
      foreheadY: mix(previous.foreheadY, current.foreheadY, amount),
      noseX: mix(previous.noseX, current.noseX, amount),
      noseY: mix(previous.noseY, current.noseY, amount),
      width: mix(previous.width, current.width, amount),
      height: mix(previous.height, current.height, amount),
      roll:
        previous.roll + angleDelta(previous.roll, current.roll) * amount,
      yaw: mix(previous.yaw, current.yaw, amount),
      pitch: mix(previous.pitch, current.pitch, amount),
    };
  }

  private drawAnimal({ landmarks, pose }: TrackingResult) {
    const { outputCanvas, outputContext } = this.requireOutput();
    const overlayCanvas = this.overlayCanvas;
    const overlayContext = this.overlayContext;
    if (!overlayCanvas || !overlayContext) return;

    overlayContext.clearRect(
      0,
      0,
      overlayCanvas.width,
      overlayCanvas.height,
    );
    const config = ANIMALS[this.variant];
    const right = {
      x: Math.cos(pose.roll),
      y: Math.sin(pose.roll),
    };
    const up = {
      x: Math.sin(pose.roll),
      y: -Math.cos(pose.roll),
    };
    const pitchOffset = pose.pitch * pose.width * 0.045;

    for (const side of [-1, 1] as const) {
      const perspective = clamp(1 + side * pose.yaw * 0.28, 0.76, 1.24);
      const x =
        pose.foreheadX +
        right.x * side * config.earSpread * pose.width +
        up.x * (config.earLift * pose.width - pitchOffset);
      const y =
        pose.foreheadY +
        right.y * side * config.earSpread * pose.width +
        up.y * (config.earLift * pose.width - pitchOffset);

      this.drawEar(
        overlayContext,
        config,
        side,
        x,
        y,
        pose.width * config.earScale,
        perspective,
        pose.roll,
      );
    }

    this.drawFaceDetails(overlayContext, config, pose);
    this.clearEyeWindows(overlayContext, landmarks, pose.roll);
    outputContext.drawImage(
      overlayCanvas as CanvasImageSource,
      0,
      0,
      outputCanvas.width,
      outputCanvas.height,
    );
  }

  private drawEar(
    context: DrawingContext,
    config: AnimalConfig,
    side: -1 | 1,
    x: number,
    y: number,
    scale: number,
    perspective: number,
    roll: number,
  ) {
    context.save();
    context.translate(x, y);
    context.rotate(roll + side * config.earTilt);
    context.scale(side * scale * perspective, scale);
    context.lineJoin = "round";
    context.lineWidth = 0.045;
    context.strokeStyle = "rgba(20, 63, 86, 0.2)";
    context.shadowColor = "rgba(20, 63, 86, 0.18)";
    context.shadowBlur = 0.11;
    context.shadowOffsetY = 0.05;

    if (config.ear === "round") {
      context.beginPath();
      context.ellipse(0, -0.12, 0.72, 0.72, 0, 0, Math.PI * 2);
      context.fillStyle = config.outer;
      context.fill();
      context.stroke();
      context.shadowColor = "transparent";
      context.beginPath();
      context.ellipse(0, -0.12, 0.4, 0.4, 0, 0, Math.PI * 2);
      context.fillStyle = config.inner;
      context.fill();
    } else if (config.ear === "tall") {
      context.beginPath();
      context.ellipse(0, -0.48, 0.42, 1.08, 0.02, 0, Math.PI * 2);
      context.fillStyle = config.outer;
      context.fill();
      context.stroke();
      context.shadowColor = "transparent";
      context.beginPath();
      context.ellipse(0, -0.5, 0.2, 0.8, 0.02, 0, Math.PI * 2);
      context.fillStyle = config.inner;
      context.fill();
    } else if (config.ear === "floppy") {
      context.beginPath();
      context.moveTo(-0.28, -0.5);
      context.bezierCurveTo(0.18, -0.72, 0.76, -0.25, 0.72, 0.34);
      context.bezierCurveTo(0.69, 0.9, 0.25, 1.2, -0.06, 0.82);
      context.bezierCurveTo(-0.3, 0.5, -0.38, -0.18, -0.28, -0.5);
      context.closePath();
      context.fillStyle = config.outer;
      context.fill();
      context.stroke();
      context.shadowColor = "transparent";
      context.beginPath();
      context.moveTo(-0.1, -0.36);
      context.bezierCurveTo(0.2, -0.42, 0.49, -0.08, 0.46, 0.36);
      context.bezierCurveTo(0.43, 0.68, 0.22, 0.84, 0.06, 0.6);
      context.bezierCurveTo(-0.06, 0.37, -0.14, -0.13, -0.1, -0.36);
      context.fillStyle = config.inner;
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(-0.52, 0.42);
      context.quadraticCurveTo(-0.34, -0.52, 0.04, -1.08);
      context.quadraticCurveTo(0.43, -0.46, 0.52, 0.46);
      context.quadraticCurveTo(0.04, 0.62, -0.52, 0.42);
      context.closePath();
      context.fillStyle = config.outer;
      context.fill();
      context.stroke();
      context.shadowColor = "transparent";
      context.beginPath();
      context.moveTo(-0.27, 0.26);
      context.quadraticCurveTo(-0.18, -0.3, 0.03, -0.72);
      context.quadraticCurveTo(0.27, -0.28, 0.3, 0.28);
      context.closePath();
      context.fillStyle = config.inner;
      context.fill();
    }

    context.restore();
  }

  private drawFaceDetails(
    context: DrawingContext,
    config: AnimalConfig,
    pose: FacePose,
  ) {
    const scale = Math.max(5, pose.width * config.noseScale);
    context.save();
    context.translate(pose.noseX, pose.noseY);
    context.rotate(pose.roll);

    context.fillStyle = config.muzzle;
    context.beginPath();
    context.ellipse(
      -scale * 0.62,
      scale * 0.72,
      scale * 0.82,
      scale * 0.66,
      -0.12,
      0,
      Math.PI * 2,
    );
    context.ellipse(
      scale * 0.62,
      scale * 0.72,
      scale * 0.82,
      scale * 0.66,
      0.12,
      0,
      Math.PI * 2,
    );
    context.fill();

    if (config.cheekMarks) {
      context.fillStyle = "rgba(255, 247, 236, 0.72)";
      for (const side of [-1, 1] as const) {
        context.beginPath();
        context.moveTo(side * scale * 1.2, scale * 0.35);
        context.lineTo(side * scale * 2.6, scale * 1.25);
        context.lineTo(side * scale * 1.15, scale * 1.55);
        context.closePath();
        context.fill();
      }
    }

    context.fillStyle = config.nose;
    context.strokeStyle = "rgba(20, 63, 86, 0.28)";
    context.lineWidth = Math.max(1, scale * 0.11);
    context.lineJoin = "round";
    if (config.noseKind === "triangle") {
      context.beginPath();
      context.moveTo(-scale, -scale * 0.25);
      context.quadraticCurveTo(0, -scale * 0.72, scale, -scale * 0.25);
      context.quadraticCurveTo(
        scale * 0.62,
        scale * 0.82,
        0,
        scale * 0.95,
      );
      context.quadraticCurveTo(
        -scale * 0.62,
        scale * 0.82,
        -scale,
        -scale * 0.25,
      );
      context.closePath();
    } else {
      context.beginPath();
      context.ellipse(0, 0, scale, scale * 0.72, 0, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(255, 255, 255, 0.55)";
    context.beginPath();
    context.ellipse(
      -scale * 0.26,
      -scale * 0.2,
      scale * 0.2,
      scale * 0.13,
      -0.25,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.strokeStyle = "rgba(20, 63, 86, 0.76)";
    context.lineWidth = Math.max(1.2, scale * 0.12);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, scale * 0.78);
    context.lineTo(0, scale * 1.45);
    context.stroke();

    if (config.whiskers) {
      context.strokeStyle = config.accent;
      context.lineWidth = Math.max(1.1, scale * 0.09);
      context.shadowColor = "rgba(20, 63, 86, 0.32)";
      context.shadowBlur = Math.max(1, scale * 0.08);
      for (const side of [-1, 1] as const) {
        for (const offset of [-0.4, 0.12, 0.64]) {
          context.beginPath();
          context.moveTo(side * scale * 0.9, scale * (0.75 + offset * 0.18));
          context.quadraticCurveTo(
            side * scale * 2.2,
            scale * (0.68 + offset * 0.42),
            side * scale * 3.35,
            scale * (0.72 + offset),
          );
          context.stroke();
        }
      }
    }

    context.restore();
  }

  private clearEyeWindows(
    context: DrawingContext,
    landmarks: NormalizedLandmark[],
    roll: number,
  ) {
    context.save();
    context.globalCompositeOperation = "destination-out";
    for (const indices of [LEFT_EYE, RIGHT_EYE]) {
      const bounds = this.landmarkBounds(landmarks, indices);
      const width = Math.max(1, bounds.maxX - bounds.minX);
      const height = Math.max(1, bounds.maxY - bounds.minY);
      context.beginPath();
      context.ellipse(
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2,
        width * 0.9 + 4,
        height * 1.35 + 4,
        roll,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.restore();
  }

  private landmarkBounds(
    landmarks: NormalizedLandmark[],
    indices: number[],
  ) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const index of indices) {
      const point = this.point(landmarks, index);
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return { minX, minY, maxX, maxY };
  }

  private averagePoint(
    landmarks: NormalizedLandmark[],
    indices: number[],
  ): Point {
    let x = 0;
    let y = 0;
    for (const index of indices) {
      const point = this.point(landmarks, index);
      x += point.x;
      y += point.y;
    }
    return {
      x: x / indices.length,
      y: y / indices.length,
    };
  }

  private point(landmarks: NormalizedLandmark[], index: number): Point {
    const { outputCanvas } = this.requireOutput();
    const point = landmarks[index];
    return {
      x: point.x * outputCanvas.width,
      y: point.y * outputCanvas.height,
    };
  }

  private enqueueOutputFrame(
    sourceFrame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>,
  ) {
    const { outputCanvas } = this.requireOutput();
    const outputFrame = new VideoFrame(outputCanvas, {
      timestamp:
        sourceFrame.timestamp ?? Math.round(performance.now() * 1_000),
    });

    try {
      controller.enqueue(outputFrame);
    } catch (error) {
      outputFrame.close();
      throw error;
    }
  }

  private resetTracking() {
    this.lastLandmarks = null;
    this.smoothedPose = null;
    this.lastDetectionRun = 0;
    this.lastFaceSeen = 0;
    this.lastTimestamp = 0;
  }

  private requireOutput() {
    if (!this.outputCanvas || !this.outputContext) {
      throw new Error("Animal effect processor is not initialized.");
    }
    return {
      outputCanvas: this.outputCanvas,
      outputContext: this.outputContext,
    };
  }
}

export function supportsAnimalEffect() {
  return (
    ProcessorWrapper.isSupported &&
    typeof VideoFrame !== "undefined" &&
    typeof TransformStream !== "undefined"
  );
}

export function createAnimalEffectProcessor(
  initialVariant: AnimalEffectVariant,
) {
  return new ProcessorWrapper<AnimalEffectOptions>(
    new AnimalEffectTransformer({ variant: initialVariant }),
    "animal-effects",
    {
      maxFps: ProcessorWrapper.hasModernApiSupport ? 24 : 18,
    },
  );
}
