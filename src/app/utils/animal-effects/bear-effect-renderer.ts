import { closeEffectImage, loadEffectImage } from "./effect-asset-loader";
import type { DrawingContext, FacePose } from "./types";

type BearAssets = {
  ear: CanvasImageSource;
  muzzle: CanvasImageSource;
};

const BEAR_EAR_ASSET = "/effects/bear/ear.webp";
const BEAR_MUZZLE_ASSET = "/effects/bear/muzzle.webp";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const BEAR_GLITTER = Array.from({ length: 168 }, (_, index) => {
  const radius = Math.sqrt((index + 0.5) / 168);
  const angle = index * GOLDEN_ANGLE;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    size: 0.55 + ((index * 17) % 11) / 14,
    alpha: 0.28 + ((index * 29) % 17) / 34,
  };
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export class BearEffectRenderer {
  private assets: BearAssets | null = null;

  async init() {
    const [ear, muzzle] = await Promise.all([
      loadEffectImage(BEAR_EAR_ASSET),
      loadEffectImage(BEAR_MUZZLE_ASSET),
    ]);
    this.assets = { ear, muzzle };
  }

  isReady() {
    return this.assets !== null;
  }

  draw(context: DrawingContext, pose: FacePose) {
    if (!this.assets) return false;

    this.drawBlush(context, pose);
    this.drawGlitter(context, pose);
    this.drawEars(context, pose, this.assets.ear);
    this.drawPrivacyMuzzle(context, pose, this.assets.muzzle);
    return true;
  }

  destroy() {
    if (this.assets) {
      closeEffectImage(this.assets.ear);
      closeEffectImage(this.assets.muzzle);
    }
    this.assets = null;
  }

  private drawEars(
    context: DrawingContext,
    pose: FacePose,
    image: CanvasImageSource,
  ) {
    const size = pose.width * 0.48;
    const right = {
      x: Math.cos(pose.roll),
      y: Math.sin(pose.roll),
    };
    const up = {
      x: Math.sin(pose.roll),
      y: -Math.cos(pose.roll),
    };

    for (const side of [-1, 1] as const) {
      const perspective = clamp(1 + side * pose.yaw * 0.2, 0.8, 1.18);
      const anchorX =
        pose.foreheadX +
        right.x * side * pose.width * 0.37 +
        up.x * pose.width * 0.14;
      const anchorY =
        pose.foreheadY +
        right.y * side * pose.width * 0.37 +
        up.y * pose.width * 0.14;

      context.save();
      context.translate(anchorX, anchorY);
      context.rotate(pose.roll + side * 0.035);
      context.scale(side * perspective, 1);
      context.globalAlpha = 0.98;
      context.shadowColor = "rgba(45, 30, 20, 0.23)";
      context.shadowBlur = Math.max(4, pose.width * 0.022);
      context.shadowOffsetY = Math.max(2, pose.width * 0.01);
      context.drawImage(image, -size * 0.5, -size * 0.52, size, size);
      context.restore();
    }
  }

  private drawPrivacyMuzzle(
    context: DrawingContext,
    pose: FacePose,
    image: CanvasImageSource,
  ) {
    const size = pose.width * 1.08;
    const yawScale = clamp(1 - Math.abs(pose.yaw) * 0.12, 0.88, 1);

    context.save();
    context.translate(pose.noseX, pose.noseY + pose.height * 0.015);
    context.rotate(pose.roll);
    context.scale(yawScale, 1);
    context.globalAlpha = 0.99;
    context.shadowColor = "rgba(43, 27, 20, 0.2)";
    context.shadowBlur = Math.max(3, pose.width * 0.018);
    context.shadowOffsetY = Math.max(1, pose.width * 0.008);
    context.drawImage(image, -size * 0.5, -size * 0.36, size, size);
    context.restore();
  }

  private drawBlush(context: DrawingContext, pose: FacePose) {
    const right = {
      x: Math.cos(pose.roll),
      y: Math.sin(pose.roll),
    };
    const down = {
      x: -Math.sin(pose.roll),
      y: Math.cos(pose.roll),
    };
    const radius = pose.width * 0.13;

    for (const side of [-1, 1] as const) {
      const x =
        pose.centerX +
        right.x * side * pose.width * 0.29 +
        down.x * pose.height * 0.08;
      const y =
        pose.centerY +
        right.y * side * pose.width * 0.29 +
        down.y * pose.height * 0.08;
      const blush = context.createRadialGradient(x, y, 0, x, y, radius);
      blush.addColorStop(0, "rgba(244, 121, 137, 0.24)");
      blush.addColorStop(0.52, "rgba(244, 121, 137, 0.11)");
      blush.addColorStop(1, "rgba(244, 121, 137, 0)");
      context.fillStyle = blush;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  private drawGlitter(context: DrawingContext, pose: FacePose) {
    const pulse = 0.94 + Math.sin(performance.now() / 340) * 0.06;

    context.save();
    context.translate(pose.centerX, pose.centerY);
    context.rotate(pose.roll);
    context.fillStyle = "#fff8ed";
    context.shadowColor = "rgba(255, 239, 211, 0.56)";
    context.shadowBlur = Math.max(1, pose.width * 0.008);

    for (const point of BEAR_GLITTER) {
      const x = point.x * pose.width * 0.48;
      const y = point.y * pose.height * 0.49;
      const centralEyeBand =
        Math.abs(y + pose.height * 0.17) < pose.height * 0.13;
      if (centralEyeBand && Math.abs(x) < pose.width * 0.36) continue;

      context.globalAlpha = point.alpha * pulse;
      context.beginPath();
      context.arc(
        x,
        y,
        Math.max(0.65, pose.width * 0.0055 * point.size),
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    context.restore();
  }
}
