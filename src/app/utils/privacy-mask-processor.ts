import {
  ProcessorWrapper,
  type VideoTrackTransformer,
  type VideoTransformerInitOptions,
} from "@livekit/track-processors";
import {
  FaceDetector,
  FilesetResolver,
  type BoundingBox,
} from "@mediapipe/tasks-vision";

const TASKS_VISION_WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_DETECTOR_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";
const DETECTION_INTERVAL_MS = 100;
const LAST_DETECTION_GRACE_MS = 320;

type PrivacyMaskOptions = Record<string, never>;
type DrawingContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

type FaceBox = Pick<BoundingBox, "originX" | "originY" | "width" | "height">;

class PrivacyMaskTransformer implements VideoTrackTransformer<PrivacyMaskOptions> {
  transformer?: TransformStream<VideoFrame, VideoFrame>;

  private detector: FaceDetector | null = null;
  private outputCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private context: DrawingContext | null = null;
  private lastBoxes: FaceBox[] = [];
  private lastDetectionRun = 0;
  private lastFaceSeen = 0;

  async init(options: VideoTransformerInitOptions) {
    this.setCanvas(options.outputCanvas);

    const vision = await FilesetResolver.forVisionTasks(TASKS_VISION_WASM_ROOT);
    this.detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: FACE_DETECTOR_MODEL,
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.55,
      minSuppressionThreshold: 0.3,
    });

    this.transformer = new TransformStream<VideoFrame, VideoFrame>({
      transform: (frame, controller) => this.transform(frame, controller),
    });
  }

  restart(options: VideoTransformerInitOptions) {
    this.setCanvas(options.outputCanvas);
    this.lastBoxes = [];
    this.lastDetectionRun = 0;
    this.lastFaceSeen = 0;
  }

  update() {
    // The first mask has no adjustable options.
  }

  destroy() {
    this.detector?.close();
    this.detector = null;
    this.outputCanvas = null;
    this.context = null;
    this.lastBoxes = [];
    this.transformer = undefined;
  }

  transform(
    frame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>,
  ) {
    try {
      this.drawSourceFrame(frame);

      try {
        const now = performance.now();
        const boxes = this.getVisibleFaceBoxes(now);

        if (boxes.length > 0) {
          boxes.forEach((box) => this.drawFaceCover(box));
        } else {
          this.drawPrivateFallback();
        }
      } catch {
        this.drawPrivateFallback();
      }

      this.enqueueCanvasFrame(frame, controller);
    } catch {
      try {
        this.drawPrivateFallback();
        this.enqueueCanvasFrame(frame, controller);
      } catch {
        // Keep the processor from ever substituting an unmasked raw frame.
      }
    } finally {
      frame.close();
    }
  }

  private setCanvas(outputCanvas: OffscreenCanvas | HTMLCanvasElement) {
    const context = outputCanvas.getContext("2d", {
      alpha: false,
    }) as DrawingContext | null;

    if (!context) {
      throw new Error("Privacy mask canvas is unavailable.");
    }

    this.outputCanvas = outputCanvas;
    this.context = context;
  }

  private drawSourceFrame(frame: VideoFrame) {
    const { context, outputCanvas } = this.requireCanvas();
    context.drawImage(frame, 0, 0, outputCanvas.width, outputCanvas.height);
  }

  private getVisibleFaceBoxes(now: number) {
    const { outputCanvas } = this.requireCanvas();

    if (
      this.detector &&
      (this.lastDetectionRun === 0 ||
        now - this.lastDetectionRun >= DETECTION_INTERVAL_MS)
    ) {
      this.lastDetectionRun = now;
      const result = this.detector.detectForVideo(outputCanvas, now);
      const boxes = result.detections.flatMap((detection) =>
        detection.boundingBox ? [this.normalizeBox(detection.boundingBox)] : [],
      );

      if (boxes.length > 0) {
        this.lastBoxes = boxes;
        this.lastFaceSeen = now;
      }
    }

    if (
      this.lastBoxes.length > 0 &&
      now - this.lastFaceSeen <= LAST_DETECTION_GRACE_MS
    ) {
      return this.lastBoxes;
    }

    this.lastBoxes = [];
    return [];
  }

  private normalizeBox(box: BoundingBox): FaceBox {
    const { outputCanvas } = this.requireCanvas();
    const width = Math.max(1, Math.min(box.width, outputCanvas.width));
    const height = Math.max(1, Math.min(box.height, outputCanvas.height));

    return {
      originX: Math.max(0, Math.min(box.originX, outputCanvas.width - width)),
      originY: Math.max(0, Math.min(box.originY, outputCanvas.height - height)),
      width,
      height,
    };
  }

  private drawFaceCover(box: FaceBox) {
    const { context, outputCanvas } = this.requireCanvas();
    const centerX = box.originX + box.width / 2;
    const centerY = box.originY + box.height * 0.52;
    const radiusX = Math.min(outputCanvas.width / 2, box.width * 0.78);
    const radiusY = Math.min(outputCanvas.height / 2, box.height * 0.86);
    const innerRadiusX = radiusX * 0.87;
    const innerRadiusY = radiusY * 0.87;

    context.save();
    context.translate(centerX, centerY);

    context.shadowColor = "rgba(10, 47, 67, 0.28)";
    context.shadowBlur = Math.max(8, box.width * 0.08);
    context.fillStyle = "#fffef9";
    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();

    context.shadowColor = "transparent";
    const gradient = context.createLinearGradient(
      -innerRadiusX,
      -innerRadiusY,
      innerRadiusX,
      innerRadiusY,
    );
    gradient.addColorStop(0, "#17495c");
    gradient.addColorStop(1, "#2f806a");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(0, 0, innerRadiusX, innerRadiusY, 0, 0, Math.PI * 2);
    context.fill();

    const markRadius = Math.max(3, Math.min(box.width, box.height) * 0.055);
    const markGap = Math.max(8, box.width * 0.18);
    context.fillStyle = "rgba(239, 249, 244, 0.96)";
    context.beginPath();
    context.arc(-markGap, -markRadius, markRadius, 0, Math.PI * 2);
    context.arc(markGap, -markRadius, markRadius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(239, 249, 244, 0.96)";
    context.lineWidth = Math.max(2, box.width * 0.025);
    context.lineCap = "round";
    context.beginPath();
    context.arc(0, markRadius * 1.5, markGap * 0.9, 0.2, Math.PI - 0.2);
    context.stroke();
    context.restore();
  }

  private drawPrivateFallback() {
    const { context, outputCanvas } = this.requireCanvas();
    const width = outputCanvas.width;
    const height = outputCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const avatarRadius = Math.max(18, Math.min(width, height) * 0.11);
    const gradient = context.createLinearGradient(0, 0, width, height);

    gradient.addColorStop(0, "#153f54");
    gradient.addColorStop(1, "#286d5f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(238, 249, 244, 0.94)";
    context.beginPath();
    context.arc(
      centerX,
      centerY - avatarRadius * 0.55,
      avatarRadius * 0.42,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.beginPath();
    context.ellipse(
      centerX,
      centerY + avatarRadius * 0.55,
      avatarRadius,
      avatarRadius * 0.6,
      0,
      Math.PI,
      Math.PI * 2,
    );
    context.fill();
  }

  private enqueueCanvasFrame(
    sourceFrame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>,
  ) {
    const { outputCanvas } = this.requireCanvas();
    const outputFrame = new VideoFrame(outputCanvas, {
      timestamp: sourceFrame.timestamp ?? Math.round(performance.now() * 1_000),
    });

    try {
      controller.enqueue(outputFrame);
    } catch (error) {
      outputFrame.close();
      throw error;
    }
  }

  private requireCanvas() {
    if (!this.outputCanvas || !this.context) {
      throw new Error("Privacy mask processor is not initialized.");
    }

    return {
      outputCanvas: this.outputCanvas,
      context: this.context,
    };
  }
}

export function supportsPrivacyMaskProcessor() {
  return ProcessorWrapper.isSupported && typeof VideoFrame !== "undefined";
}

export function createPrivacyMaskProcessor() {
  return new ProcessorWrapper<PrivacyMaskOptions>(
    new PrivacyMaskTransformer(),
    "privacy-mask",
    {
      maxFps: ProcessorWrapper.hasModernApiSupport ? 24 : 18,
    },
  );
}
