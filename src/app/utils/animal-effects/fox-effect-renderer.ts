import { closeEffectImage, loadEffectImage } from "./effect-asset-loader";
import type { DrawingContext, FacePose } from "./types";

type FoxAssets = {
  ear: CanvasImageSource;
  muzzle: CanvasImageSource;
};

const FOX_EAR_ASSET = "/effects/fox/ear.webp";
const FOX_MUZZLE_ASSET = "/effects/fox/muzzle.webp";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const FOX_GLITTER = Array.from({ length: 138 }, (_, index) => {
  const radius = Math.sqrt((index + 0.5) / 138);
  const angle = index * GOLDEN_ANGLE;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    size: 0.5 + ((index * 19) % 11) / 15,
    alpha: 0.23 + ((index * 31) % 17) / 38,
  };
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export class FoxEffectRenderer {
  private assets: FoxAssets | null = null;

  async init() {
    const [ear, muzzle] = await Promise.all([
      loadEffectImage(FOX_EAR_ASSET),
      loadEffectImage(FOX_MUZZLE_ASSET),
    ]);
    this.assets = { ear, muzzle };
  }

  isReady() {
    return this.assets !== null;
  }

  draw(context: DrawingContext, pose: FacePose) {
    if (!this.assets) return false;

    this.drawUpperFaceGlow(context, pose);
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
    const size = pose.width * 0.62;
    const right = {
      x: Math.cos(pose.roll),
      y: Math.sin(pose.roll),
    };
    const up = {
      x: Math.sin(pose.roll),
      y: -Math.cos(pose.roll),
    };

    for (const side of [-1, 1] as const) {
      const perspective = clamp(1 + side * pose.yaw * 0.24, 0.76, 1.2);
      const anchorX =
        pose.foreheadX +
        right.x * side * pose.width * 0.32 +
        up.x * pose.width * 0.2;
      const anchorY =
        pose.foreheadY +
        right.y * side * pose.width * 0.32 +
        up.y * pose.width * 0.2;

      context.save();
      context.translate(anchorX, anchorY);
      context.rotate(pose.roll + side * 0.045);
      context.scale(side * perspective, 1);
      context.globalAlpha = 0.98;
      context.shadowColor = "rgba(73, 34, 15, 0.22)";
      context.shadowBlur = Math.max(4, pose.width * 0.022);
      context.shadowOffsetY = Math.max(2, pose.width * 0.01);
      context.drawImage(image, -size * 0.5, -size * 0.5, size, size);
      context.restore();
    }
  }

  private drawPrivacyMuzzle(
    context: DrawingContext,
    pose: FacePose,
    image: CanvasImageSource,
  ) {
    const size = pose.width * 1.12;
    const yawScale = clamp(1 - Math.abs(pose.yaw) * 0.12, 0.88, 1);

    context.save();
    context.translate(pose.noseX, pose.noseY + pose.height * 0.015);
    context.rotate(pose.roll);
    context.scale(yawScale, 1);
    context.globalAlpha = 0.99;
    context.shadowColor = "rgba(66, 34, 18, 0.2)";
    context.shadowBlur = Math.max(3, pose.width * 0.018);
    context.shadowOffsetY = Math.max(1, pose.width * 0.008);
    context.drawImage(image, -size * 0.5, -size * 0.39, size, size);
    context.restore();
  }

  private drawUpperFaceGlow(context: DrawingContext, pose: FacePose) {
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
        right.x * side * pose.width * 0.28 +
        down.x * pose.height * 0.015;
      const y =
        pose.centerY +
        right.y * side * pose.width * 0.28 +
        down.y * pose.height * 0.015;
      const glow = context.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, "rgba(249, 151, 124, 0.2)");
      glow.addColorStop(0.55, "rgba(249, 151, 124, 0.08)");
      glow.addColorStop(1, "rgba(249, 151, 124, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  private drawGlitter(context: DrawingContext, pose: FacePose) {
    const pulse = 0.94 + Math.sin(performance.now() / 360) * 0.06;

    context.save();
    context.translate(pose.centerX, pose.centerY - pose.height * 0.13);
    context.rotate(pose.roll);
    context.fillStyle = "#fff4df";
    context.shadowColor = "rgba(255, 215, 159, 0.5)";
    context.shadowBlur = Math.max(1, pose.width * 0.007);

    for (const point of FOX_GLITTER) {
      const x = point.x * pose.width * 0.46;
      const y = point.y * pose.height * 0.32;
      const eyeBand = Math.abs(y) < pose.height * 0.12;
      if (eyeBand && Math.abs(x) < pose.width * 0.37) continue;

      context.globalAlpha = point.alpha * pulse;
      context.beginPath();
      context.arc(
        x,
        y,
        Math.max(0.6, pose.width * 0.005 * point.size),
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    context.restore();
  }
}
