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

class FaceEffectTransformer implements VideoTrackTransformer<FaceEffectOptions> {
  transformer?: TransformStream<VideoFrame, VideoFrame>;

  private outputCanvas: EffectCanvas | null = null;
  private outputContext: DrawingContext | null = null;
  private readonly faceTracker = new FaceTracker();
  private readonly qualityController = new AdaptiveQualityController();
  private readonly overlayRenderer: AnimalOverlayRenderer;

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
      const { outputCanvas, outputContext } = this.requireOutput();
      outputContext.drawImage(
        frame,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height,
      );

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
    this.overlayRenderer.resize(outputCanvas.width, outputCanvas.height);
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
    "face-effects",
    {
      maxFps: ProcessorWrapper.hasModernApiSupport ? 24 : 18,
    },
  );
}
