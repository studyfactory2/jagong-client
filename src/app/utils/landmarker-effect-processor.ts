import {
  ProcessorWrapper,
  type VideoTrackTransformer,
  type VideoTransformerInitOptions,
} from "@livekit/track-processors";
import { AdaptiveQualityController } from "./animal-effects/adaptive-quality";
import { AnimalOverlayRenderer } from "./animal-effects/animal-overlay-renderer";
import { FaceTracker } from "./animal-effects/face-tracker";
import type {
  DrawingContext,
  EffectCanvas,
  FaceEffectOptions,
  FaceEffectVariant,
} from "./animal-effects/types";

export type {
  AccessoryEffectVariant,
  AnimalEffectVariant,
  FaceEffectOptions,
  FaceEffectVariant,
} from "./animal-effects/types";

const FACE_EFFECT_PROCESSOR_NAME = "face-effects";
const ASPECT_RATIO_TOLERANCE = 0.02;

function frameDimensions(frame: VideoFrame) {
  return {
    width: frame.displayWidth || frame.codedWidth,
    height: frame.displayHeight || frame.codedHeight,
  };
}

class FaceEffectTransformer implements VideoTrackTransformer<FaceEffectOptions> {
  transformer?: TransformStream<VideoFrame, VideoFrame>;

  private outputCanvas: EffectCanvas | null = null;
  private outputContext: DrawingContext | null = null;
  private readonly faceTracker = new FaceTracker();
  private readonly qualityController = new AdaptiveQualityController();
  private readonly overlayRenderer: AnimalOverlayRenderer;
  private frameDimensionsSynced = false;

  constructor(options: FaceEffectOptions) {
    this.overlayRenderer = new AnimalOverlayRenderer(options.variant);
  }

  async init(options: VideoTransformerInitOptions) {
    this.setOutputCanvas(options.outputCanvas);
    await this.faceTracker.init();
    await this.overlayRenderer.init();
    this.transformer = new TransformStream<VideoFrame, VideoFrame>({
      transform: (frame, controller) => this.transform(frame, controller),
    });
  }

  restart(options: VideoTransformerInitOptions) {
    this.setOutputCanvas(options.outputCanvas);
    this.faceTracker.reset();
  }

  update(options: FaceEffectOptions) {
    this.overlayRenderer.update(options.variant);
  }

  destroy() {
    this.faceTracker.destroy();
    this.overlayRenderer.destroy();
    this.outputCanvas = null;
    this.outputContext = null;
    this.frameDimensionsSynced = false;
    this.transformer = undefined;
  }

  transform(
    frame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>,
  ) {
    if (!this.qualityController.shouldProcessFrame(performance.now())) {
      frame.close();
      return;
    }

    const frameStartedAt = performance.now();
    try {
      this.syncOutputDimensions(frame);
      const { outputCanvas, outputContext } = this.requireOutput();
      this.drawFrameCover(frame, outputCanvas, outputContext);

      try {
        const tracking = this.faceTracker.track(
          outputCanvas as CanvasImageSource,
          outputCanvas.width,
          outputCanvas.height,
          this.qualityController.profile,
        );
        if (tracking) {
          this.overlayRenderer.draw(
            outputCanvas,
            outputContext,
            tracking,
            this.qualityController.profile,
          );
        }
      } catch {
        // Character effects are decorative. A tracking failure keeps the raw
        // camera usable instead of freezing or publishing an outdated frame.
      }

      this.enqueueOutputFrame(frame, controller);
    } catch {
      // The input frame is still closed below if the output canvas failed.
    } finally {
      frame.close();
      const now = performance.now();
      this.qualityController.recordFrameCost(now - frameStartedAt, now);
    }
  }

  private setOutputCanvas(outputCanvas: EffectCanvas) {
    const context = outputCanvas.getContext("2d", {
      alpha: false,
    }) as DrawingContext | null;
    if (!context) {
      throw new Error("Animal effect output canvas is unavailable.");
    }

    this.outputCanvas = outputCanvas;
    this.outputContext = context;
    this.frameDimensionsSynced = false;
    this.overlayRenderer.resize(outputCanvas.width, outputCanvas.height);
  }

  private syncOutputDimensions(frame: VideoFrame) {
    if (this.frameDimensionsSynced) return;

    const { width, height } = frameDimensions(frame);
    if (!width || !height) return;

    const { outputCanvas } = this.requireOutput();
    const frameRatio = width / height;
    const canvasRatio = outputCanvas.width / outputCanvas.height;
    const ratioMismatch =
      !Number.isFinite(canvasRatio) ||
      Math.abs(frameRatio - canvasRatio) > ASPECT_RATIO_TOLERANCE;

    if (ratioMismatch) {
      outputCanvas.width = width;
      outputCanvas.height = height;

      const context = outputCanvas.getContext("2d", {
        alpha: false,
      }) as DrawingContext | null;
      if (!context) {
        throw new Error("Animal effect output canvas is unavailable.");
      }

      this.outputContext = context;
      this.overlayRenderer.resize(width, height);
      this.resizeFallbackCanvas(width, height);
    }

    this.frameDimensionsSynced = true;
  }

  private resizeFallbackCanvas(width: number, height: number) {
    if (typeof document === "undefined") return;

    const displayCanvas = document.querySelector<HTMLCanvasElement>(
      `canvas[data-livekit-processor="${FACE_EFFECT_PROCESSOR_NAME}"]`,
    );
    if (!displayCanvas) return;

    displayCanvas.width = width;
    displayCanvas.height = height;
  }

  private drawFrameCover(
    frame: VideoFrame,
    outputCanvas: EffectCanvas,
    outputContext: DrawingContext,
  ) {
    const { width: frameWidth, height: frameHeight } = frameDimensions(frame);
    if (!frameWidth || !frameHeight) {
      outputContext.drawImage(
        frame,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height,
      );
      return;
    }

    const frameRatio = frameWidth / frameHeight;
    const canvasRatio = outputCanvas.width / outputCanvas.height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = frameWidth;
    let sourceHeight = frameHeight;

    if (frameRatio > canvasRatio) {
      sourceWidth = frameHeight * canvasRatio;
      sourceX = (frameWidth - sourceWidth) / 2;
    } else if (frameRatio < canvasRatio) {
      sourceHeight = frameWidth / canvasRatio;
      sourceY = (frameHeight - sourceHeight) / 2;
    }

    outputContext.drawImage(
      frame,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputCanvas.width,
      outputCanvas.height,
    );
  }

  private enqueueOutputFrame(
    sourceFrame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>,
  ) {
    const { outputCanvas } = this.requireOutput();
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

export function supportsFaceEffect() {
  return (
    ProcessorWrapper.isSupported &&
    typeof VideoFrame !== "undefined" &&
    typeof TransformStream !== "undefined"
  );
}

export function createFaceEffectProcessor(
  initialVariant: FaceEffectVariant,
) {
  return new ProcessorWrapper<FaceEffectOptions>(
    new FaceEffectTransformer({ variant: initialVariant }),
    FACE_EFFECT_PROCESSOR_NAME,
    {
      maxFps: ProcessorWrapper.hasModernApiSupport ? 24 : 18,
    },
  );
}
