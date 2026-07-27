import type { DrawingContext, FacePose } from "./animal-effects/types";
import {
  closeEffectImage,
  loadEffectImage,
} from "./animal-effects/effect-asset-loader";

type DogAssets = {
  ear: CanvasImageSource;
  muzzle: CanvasImageSource;
};

const DOG_EAR_ASSET = "/effects/dog/ear.webp";
const DOG_MUZZLE_ASSET = "/effects/dog/muzzle.webp";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DOG_GLITTER = Array.from({ length: 168 }, (_, index) => {
  const radius = Math.sqrt((index + 0.5) / 168);
  const angle = index * GOLDEN_ANGLE;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    size: 0.55 + ((index * 17) % 11) / 14,
    alpha: 0.28 + ((index * 29) % 17) / 34,
  };
});

export class DogEffectRenderer {
  private assets: DogAssets | null = null;

  async init() {
    const [ear, muzzle] = await Promise.all([
      loadEffectImage(DOG_EAR_ASSET),
      loadEffectImage(DOG_MUZZLE_ASSET),
    ]);
    this.assets = { ear, muzzle };
  }

  draw(context: DrawingContext, pose: FacePose) {
    if (!this.assets) return false;
    this.drawBlush(context, pose);
    this.drawGlitter(context, pose);
    this.drawEars(context, pose, this.assets.ear);
    this.drawMuzzle(context, pose, this.assets.muzzle);
    return true;
  }

  isReady() {
    return this.assets !== null;
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
    const size = pose.width * 0.82;
    const right = {
      x: Math.cos(pose.roll),
      y: Math.sin(pose.roll),
    };
    const up = {
      x: Math.sin(pose.roll),
      y: -Math.cos(pose.roll),
    };

    for (const side of [-1, 1] as const) {
      const perspective = Math.max(
        0.76,
        Math.min(1.2, 1 + side * pose.yaw * 0.24),
      );
      const anchorX =
        pose.foreheadX +
        right.x * side * pose.width * 0.35 +
        up.x * pose.width * 0.13;
      const anchorY =
        pose.foreheadY +
        right.y * side * pose.width * 0.35 +
        up.y * pose.width * 0.13;

      context.save();
      context.translate(anchorX, anchorY);
      context.rotate(pose.roll + side * 0.11);
      context.scale(side * perspective, 1);
      context.globalAlpha = 0.98;
      context.shadowColor = "rgba(20, 31, 37, 0.22)";
      context.shadowBlur = Math.max(4, pose.width * 0.025);
      context.shadowOffsetY = Math.max(2, pose.width * 0.012);
      context.drawImage(image, -size * 0.5, -size * 0.5, size, size);
      context.restore();
    }
  }

  private drawMuzzle(
    context: DrawingContext,
    pose: FacePose,
    image: CanvasImageSource,
  ) {
    const size = pose.width * 0.9;
    const yawScale = Math.max(0.82, 1 - Math.abs(pose.yaw) * 0.16);

    context.save();
    context.translate(pose.noseX, pose.noseY);
    context.rotate(pose.roll);
    context.scale(yawScale, 1);
    context.globalAlpha = 0.98;
    context.shadowColor = "rgba(31, 22, 20, 0.2)";
    context.shadowBlur = Math.max(3, pose.width * 0.018);
    context.shadowOffsetY = Math.max(1, pose.width * 0.008);
    context.drawImage(image, -size * 0.5, -size * 0.4, size, size);
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
      blush.addColorStop(0, "rgba(246, 119, 134, 0.24)");
      blush.addColorStop(0.52, "rgba(246, 119, 134, 0.12)");
      blush.addColorStop(1, "rgba(246, 119, 134, 0)");
      context.fillStyle = blush;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  private drawGlitter(context: DrawingContext, pose: FacePose) {
    context.save();
    context.translate(pose.centerX, pose.centerY);
    context.rotate(pose.roll);
    context.fillStyle = "#fff9ef";
    context.shadowColor = "rgba(255, 248, 228, 0.5)";
    context.shadowBlur = Math.max(1, pose.width * 0.008);

    for (const point of DOG_GLITTER) {
      const x = point.x * pose.width * 0.48;
      const y = point.y * pose.height * 0.49;
      const centralEyeBand =
        Math.abs(y + pose.height * 0.17) < pose.height * 0.12;
      if (centralEyeBand && Math.abs(x) < pose.width * 0.34) continue;

      context.globalAlpha = point.alpha;
      context.beginPath();
      context.arc(
        x,
        y,
        Math.max(0.7, pose.width * 0.006 * point.size),
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    context.restore();
  }
}
