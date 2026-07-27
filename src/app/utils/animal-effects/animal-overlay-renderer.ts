import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { DogEffectRenderer } from "../dog-effect-renderer";
import {
  WebGlBeautyRenderer,
  type BeautyFaceMask,
  type BeautyTreatment,
} from "../webgl-beauty-renderer";
import type { AdaptiveQualityProfile } from "./adaptive-quality";
import { AccessoryEffectRenderer } from "./accessory-effect-renderer";
import { ANIMAL_CONFIGS } from "./animal-config";
import { BasicAnimalRenderer } from "./basic-animal-renderer";
import { BearEffectRenderer } from "./bear-effect-renderer";
import { BunnyEffectRenderer } from "./bunny-effect-renderer";
import { CatEffectRenderer } from "./cat-effect-renderer";
import { FoxEffectRenderer } from "./fox-effect-renderer";
import { GlassesEffectRenderer } from "./glasses-effect-renderer";
import {
  LEFT_EYE,
  LOWER_LIP,
  RIGHT_EYE,
  UPPER_LIP,
  averageLandmarkPoint,
  landmarkBounds,
} from "./landmark-utils";
import type {
  AccessoryEffectVariant,
  AnimalEffectVariant,
  DrawingContext,
  EffectCanvas,
  FaceEffectVariant,
  TrackingResult,
} from "./types";

const isAnimalEffect = (
  variant: FaceEffectVariant,
): variant is AnimalEffectVariant => variant in ANIMAL_CONFIGS;

type LowerFaceAccessoryVariant = Exclude<AccessoryEffectVariant, "glasses">;

const isLowerFaceAccessoryEffect = (
  variant: FaceEffectVariant,
): variant is LowerFaceAccessoryVariant =>
  variant === "medical-mask" || variant === "beard";

export class AnimalOverlayRenderer {
  private variant: FaceEffectVariant;
  private overlayCanvas: EffectCanvas | null = null;
  private overlayContext: DrawingContext | null = null;
  private readonly dogRenderer = new DogEffectRenderer();
  private readonly catRenderer = new CatEffectRenderer();
  private readonly bearRenderer = new BearEffectRenderer();
  private readonly bunnyRenderer = new BunnyEffectRenderer();
  private readonly foxRenderer = new FoxEffectRenderer();
  private readonly accessoryRenderer = new AccessoryEffectRenderer();
  private readonly glassesRenderer = new GlassesEffectRenderer();
  private readonly basicRenderer = new BasicAnimalRenderer();
  private beautyRenderer: WebGlBeautyRenderer | null = null;
  private beautyUnavailable = false;

  constructor(initialVariant: FaceEffectVariant) {
    this.variant = initialVariant;
  }

  async init() {
    await Promise.all([
      this.dogRenderer.init().catch(() => undefined),
      this.catRenderer.init().catch(() => undefined),
      this.bearRenderer.init().catch(() => undefined),
      this.bunnyRenderer.init().catch(() => undefined),
      this.foxRenderer.init().catch(() => undefined),
      this.accessoryRenderer.init().catch(() => undefined),
      this.glassesRenderer.init().catch(() => undefined),
    ]);
  }

  update(variant: FaceEffectVariant) {
    this.variant = variant;
  }

  resize(width: number, height: number) {
    if (!this.overlayCanvas) {
      this.overlayCanvas = this.createCanvas(width, height);
      this.overlayContext = this.overlayCanvas.getContext(
        "2d",
      ) as DrawingContext | null;
    } else if (
      this.overlayCanvas.width !== width ||
      this.overlayCanvas.height !== height
    ) {
      this.overlayCanvas.width = width;
      this.overlayCanvas.height = height;
    }

    if (!this.overlayContext) {
      throw new Error("Animal effect overlay canvas is unavailable.");
    }
  }

  draw(
    outputCanvas: EffectCanvas,
    outputContext: DrawingContext,
    tracking: TrackingResult,
    profile: AdaptiveQualityProfile,
  ) {
    this.resize(outputCanvas.width, outputCanvas.height);
    const overlayCanvas = this.overlayCanvas;
    const overlayContext = this.overlayContext;
    if (!overlayCanvas || !overlayContext) return;

    const { landmarks, pose } = tracking;
    const useDogRenderer = this.variant === "dog" && this.dogRenderer.isReady();
    const useCatRenderer = this.variant === "cat" && this.catRenderer.isReady();
    const useBearRenderer =
      this.variant === "bear" && this.bearRenderer.isReady();
    const useBunnyRenderer =
      this.variant === "bunny" && this.bunnyRenderer.isReady();
    const useFoxRenderer =
      this.variant === "fox" && this.foxRenderer.isReady();
    const useAccessoryRenderer =
      isLowerFaceAccessoryEffect(this.variant) &&
      this.accessoryRenderer.isReady(this.variant);
    const useGlassesRenderer =
      this.variant === "glasses" && this.glassesRenderer.isReady();
    if (
      useDogRenderer ||
      useCatRenderer ||
      useBearRenderer ||
      useBunnyRenderer ||
      useFoxRenderer ||
      useAccessoryRenderer ||
      useGlassesRenderer
    ) {
      this.applyBeauty(outputCanvas, outputContext, tracking, profile);
    }

    overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const config = isAnimalEffect(this.variant)
      ? ANIMAL_CONFIGS[this.variant]
      : null;

    if (useGlassesRenderer) {
      this.glassesRenderer.draw(
        overlayContext,
        landmarks,
        pose,
        overlayCanvas.width,
        overlayCanvas.height,
      );
    } else if (
      useAccessoryRenderer &&
      isLowerFaceAccessoryEffect(this.variant)
    ) {
      this.accessoryRenderer.draw(overlayContext, this.variant, pose);
    } else if (useDogRenderer) {
      this.dogRenderer.draw(overlayContext, pose);
    } else if (useBearRenderer) {
      this.bearRenderer.draw(overlayContext, pose);
    } else if (useBunnyRenderer) {
      this.bunnyRenderer.draw(overlayContext, pose);
    } else if (useFoxRenderer) {
      this.foxRenderer.draw(overlayContext, pose);
    } else if (this.variant === "cat" && config) {
      this.catRenderer.drawBase(overlayContext, config, pose);
    } else if (config) {
      this.basicRenderer.draw(overlayContext, config, pose);
    }

    if (this.variant !== "glasses") {
      this.clearEyeWindows(
        overlayContext,
        landmarks,
        pose.roll,
        overlayCanvas.width,
        overlayCanvas.height,
      );
    }
    if (this.variant === "cat") {
      this.catRenderer.drawAccents(
        overlayContext,
        landmarks,
        pose,
        overlayCanvas.width,
        overlayCanvas.height,
      );
    }

    outputContext.drawImage(
      overlayCanvas as CanvasImageSource,
      0,
      0,
      outputCanvas.width,
      outputCanvas.height,
    );
  }

  destroy() {
    this.overlayCanvas = null;
    this.overlayContext = null;
    this.dogRenderer.destroy();
    this.catRenderer.destroy();
    this.bearRenderer.destroy();
    this.bunnyRenderer.destroy();
    this.foxRenderer.destroy();
    this.accessoryRenderer.destroy();
    this.glassesRenderer.destroy();
    this.beautyRenderer?.destroy();
    this.beautyRenderer = null;
    this.beautyUnavailable = false;
  }

  private applyBeauty(
    outputCanvas: EffectCanvas,
    outputContext: DrawingContext,
    tracking: TrackingResult,
    profile: AdaptiveQualityProfile,
  ) {
    if (!profile.beautyEnabled) {
      this.beautyRenderer?.destroy();
      this.beautyRenderer = null;
      return;
    }
    if (this.beautyUnavailable) return;

    if (
      this.beautyRenderer &&
      !this.beautyRenderer.matchesSize(outputCanvas.width, outputCanvas.height)
    ) {
      this.beautyRenderer.destroy();
      this.beautyRenderer = null;
    }

    if (!this.beautyRenderer) {
      try {
        this.beautyRenderer = new WebGlBeautyRenderer(
          outputCanvas.width,
          outputCanvas.height,
        );
      } catch {
        this.beautyUnavailable = true;
        return;
      }
    }

    const { landmarks, pose } = tracking;
    const bounds = (indices: number[]) =>
      landmarkBounds(
        landmarks,
        indices,
        outputCanvas.width,
        outputCanvas.height,
      );
    const averagePoint = (indices: number[]) =>
      averageLandmarkPoint(
        landmarks,
        indices,
        outputCanvas.width,
        outputCanvas.height,
      );
    const leftEyeBounds = bounds(LEFT_EYE);
    const rightEyeBounds = bounds(RIGHT_EYE);
    const leftEye = averagePoint(LEFT_EYE);
    const rightEye = averagePoint(RIGHT_EYE);
    const mouth = averagePoint([UPPER_LIP, LOWER_LIP]);
    const eyeWidth = Math.max(
      leftEyeBounds.maxX - leftEyeBounds.minX,
      rightEyeBounds.maxX - rightEyeBounds.minX,
    );
    const eyeHeight = Math.max(
      leftEyeBounds.maxY - leftEyeBounds.minY,
      rightEyeBounds.maxY - rightEyeBounds.minY,
    );
    const mask: BeautyFaceMask = {
      center: { x: pose.centerX, y: pose.centerY },
      radiusX: pose.width * 0.56,
      radiusY: pose.height * 0.55,
      roll: pose.roll,
      leftEye,
      rightEye,
      eyeRadiusX: eyeWidth * 0.72,
      eyeRadiusY: eyeHeight * 1.15,
      mouth,
      mouthRadiusX: pose.width * 0.17,
      mouthRadiusY: pose.height * 0.11,
    };
    const treatment: BeautyTreatment = (() => {
      if (this.variant === "glasses") {
        return {
          strength: Math.min(0.62, profile.beautyStrength * 1.78),
          brightness: 0.088,
          warmth: 0.002,
        };
      }
      if (this.variant === "medical-mask") {
        return {
          strength: Math.min(0.58, profile.beautyStrength * 1.68),
          brightness: 0.07,
          warmth: 0.008,
        };
      }
      if (this.variant === "beard") {
        return {
          strength: Math.min(0.52, profile.beautyStrength * 1.5),
          brightness: 0.052,
          warmth: 0.012,
        };
      }
      if (this.variant === "cat") {
        return {
          strength: Math.min(0.58, profile.beautyStrength * 1.7),
          brightness: 0.072,
          warmth: 0.014,
        };
      }
      if (this.variant === "bear") {
        return {
          strength: Math.min(0.54, profile.beautyStrength * 1.55),
          brightness: 0.06,
          warmth: 0.012,
        };
      }
      if (this.variant === "bunny") {
        return {
          strength: Math.min(0.56, profile.beautyStrength * 1.62),
          brightness: 0.068,
          warmth: 0.011,
        };
      }
      if (this.variant === "fox") {
        return {
          strength: Math.min(0.55, profile.beautyStrength * 1.6),
          brightness: 0.064,
          warmth: 0.016,
        };
      }
      return {
        strength: profile.beautyStrength,
        brightness: 0.028,
        warmth: 0.006,
      };
    })();
    const rendered = this.beautyRenderer.render(
      outputCanvas,
      mask,
      treatment,
    );
    if (rendered) {
      outputContext.drawImage(
        rendered,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height,
      );
    }
  }

  private clearEyeWindows(
    context: DrawingContext,
    landmarks: NormalizedLandmark[],
    roll: number,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    context.save();
    context.globalCompositeOperation = "destination-out";
    for (const indices of [LEFT_EYE, RIGHT_EYE]) {
      const bounds = landmarkBounds(
        landmarks,
        indices,
        canvasWidth,
        canvasHeight,
      );
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

  private createCanvas(width: number, height: number): EffectCanvas {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
}
