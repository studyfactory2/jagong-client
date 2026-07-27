import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { closeEffectImage, loadEffectImage } from "./effect-asset-loader";
import {
  LEFT_EYE,
  RIGHT_EYE,
  averageLandmarkPoint,
} from "./landmark-utils";
import type { DrawingContext, FacePose } from "./types";

const GLASSES_ASSET = "/effects/accessories/glasses.webp";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export class GlassesEffectRenderer {
  private image: CanvasImageSource | null = null;

  async init() {
    this.image = await loadEffectImage(GLASSES_ASSET);
  }

  isReady() {
    return this.image !== null;
  }

  draw(
    context: DrawingContext,
    landmarks: NormalizedLandmark[],
    pose: FacePose,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    if (!this.image) return false;

    const leftEye = averageLandmarkPoint(
      landmarks,
      LEFT_EYE,
      canvasWidth,
      canvasHeight,
    );
    const rightEye = averageLandmarkPoint(
      landmarks,
      RIGHT_EYE,
      canvasWidth,
      canvasHeight,
    );
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };
    const eyeDistance = Math.hypot(
      rightEye.x - leftEye.x,
      rightEye.y - leftEye.y,
    );
    const eyeRoll = Math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x,
    );
    const size = Math.max(pose.width * 1.12, eyeDistance * 2.7);
    const yawScale = clamp(1 - Math.abs(pose.yaw) * 0.12, 0.88, 1);

    context.save();
    context.translate(eyeCenter.x, eyeCenter.y + pose.height * 0.005);
    context.rotate(eyeRoll);
    context.scale(yawScale, 1);
    context.globalAlpha = 0.99;
    context.shadowColor = "rgba(17, 20, 24, 0.22)";
    context.shadowBlur = Math.max(3, pose.width * 0.016);
    context.shadowOffsetY = Math.max(1, pose.width * 0.006);
    context.drawImage(this.image, -size * 0.5, -size * 0.52, size, size);
    context.restore();
    return true;
  }

  destroy() {
    if (this.image) closeEffectImage(this.image);
    this.image = null;
  }
}
