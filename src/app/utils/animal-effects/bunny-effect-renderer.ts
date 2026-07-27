import { closeEffectImage, loadEffectImage } from "./effect-asset-loader";
import type { DrawingContext, FacePose } from "./types";

type BunnyAssets = {
  ear: CanvasImageSource;
  muzzle: CanvasImageSource;
};

const BUNNY_EAR_ASSET = "/effects/bunny/ear.webp";
const BUNNY_MUZZLE_ASSET = "/effects/bunny/muzzle.webp";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const BUNNY_GLITTER = Array.from({ length: 132 }, (_, index) => {
  const radius = Math.sqrt((index + 0.5) / 132);
  const angle = index * GOLDEN_ANGLE;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    size: 0.5 + ((index * 13) % 11) / 15,
    alpha: 0.24 + ((index * 23) % 17) / 38,
  };
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export class BunnyEffectRenderer {
  private assets: BunnyAssets | null = null;

  async init() {
    const [ear, muzzle] = await Promise.all([
      loadEffectImage(BUNNY_EAR_ASSET),
      loadEffectImage(BUNNY_MUZZLE_ASSET),
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
    const size = pose.width * 0.78;
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
        right.x * side * pose.width * 0.2 +
        up.x * pose.width * 0.29;
      const anchorY =
        pose.foreheadY +
        right.y * side * pose.width * 0.2 +
        up.y * pose.width * 0.29;

      context.save();
      context.translate(anchorX, anchorY);
      context.rotate(pose.roll + side * 0.065);
      context.scale(side * perspective, 1);
      context.globalAlpha = 0.98;
      context.shadowColor = "rgba(65, 42, 48, 0.18)";
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
    const size = pose.width * 1.08;
    const yawScale = clamp(1 - Math.abs(pose.yaw) * 0.12, 0.88, 1);

    context.save();
    context.translate(pose.noseX, pose.noseY + pose.height * 0.015);
    context.rotate(pose.roll);
    context.scale(yawScale, 1);
    context.globalAlpha = 0.99;
    context.shadowColor = "rgba(78, 47, 55, 0.17)";
    context.shadowBlur = Math.max(3, pose.width * 0.016);
    context.shadowOffsetY = Math.max(1, pose.width * 0.008);
    context.drawImage(image, -size * 0.5, -size * 0.45, size, size);
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
    const radius = pose.width * 0.14;

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
      blush.addColorStop(0, "rgba(248, 130, 157, 0.28)");
      blush.addColorStop(0.52, "rgba(248, 130, 157, 0.13)");
      blush.addColorStop(1, "rgba(248, 130, 157, 0)");
      context.fillStyle = blush;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  private drawGlitter(context: DrawingContext, pose: FacePose) {
    const pulse = 0.94 + Math.sin(performance.now() / 360) * 0.06;

    context.save();
    context.translate(pose.centerX, pose.centerY);
    context.rotate(pose.roll);
    context.fillStyle = "#fff8fb";
    context.shadowColor = "rgba(255, 222, 236, 0.52)";
    context.shadowBlur = Math.max(1, pose.width * 0.008);

    for (const point of BUNNY_GLITTER) {
      const x = point.x * pose.width * 0.47;
      const y = point.y * pose.height * 0.48;
      const centralEyeBand =
        Math.abs(y + pose.height * 0.17) < pose.height * 0.13;
      if (centralEyeBand && Math.abs(x) < pose.width * 0.36) continue;

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
