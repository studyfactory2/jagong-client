import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { AnimalConfig } from "./animal-config";
import { closeEffectImage, loadEffectImage } from "./effect-asset-loader";
import { LEFT_EYE, RIGHT_EYE, landmarkBounds } from "./landmark-utils";
import type { DrawingContext, FacePose } from "./types";

type CatAssets = {
  ear: CanvasImageSource;
  muzzle: CanvasImageSource;
};

const CAT_EAR_ASSET = "/effects/cat/ear.webp";
const CAT_MUZZLE_ASSET = "/effects/cat/muzzle.webp";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const CAT_GLITTER = Array.from({ length: 184 }, (_, index) => {
  const radius = Math.sqrt((index + 0.5) / 184);
  const angle = index * GOLDEN_ANGLE;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    size: 0.5 + ((index * 19) % 13) / 15,
    alpha: 0.32 + ((index * 31) % 19) / 32,
  };
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export class CatEffectRenderer {
  private assets: CatAssets | null = null;

  async init() {
    const [ear, muzzle] = await Promise.all([
      loadEffectImage(CAT_EAR_ASSET),
      loadEffectImage(CAT_MUZZLE_ASSET),
    ]);
    this.assets = { ear, muzzle };
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

  drawBase(context: DrawingContext, config: AnimalConfig, pose: FacePose) {
    if (this.assets) {
      this.drawAssetBlush(context, pose);
      this.drawFaceGlitter(context, pose);
      this.drawAssetEars(context, pose, this.assets.ear);
      this.drawAssetMuzzle(context, pose, this.assets.muzzle);
      this.drawAssetWhiskers(context, pose);
      return;
    }

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
        context,
        config,
        side,
        x,
        y,
        pose.width * config.earScale,
        perspective,
        pose.roll,
      );
    }

    this.drawFaceDetails(context, config, pose);
  }

  drawAccents(
    context: DrawingContext,
    landmarks: NormalizedLandmark[],
    pose: FacePose,
    width: number,
    height: number,
  ) {
    this.drawEyeAccents(context, landmarks, pose.roll, width, height);
    this.drawSparkle(context, pose);
  }

  private drawAssetEars(
    context: DrawingContext,
    pose: FacePose,
    image: CanvasImageSource,
  ) {
    const size = pose.width * 0.68;
    const right = {
      x: Math.cos(pose.roll),
      y: Math.sin(pose.roll),
    };
    const up = {
      x: Math.sin(pose.roll),
      y: -Math.cos(pose.roll),
    };

    for (const side of [-1, 1] as const) {
      const perspective = clamp(1 + side * pose.yaw * 0.22, 0.78, 1.2);
      const anchorX =
        pose.foreheadX +
        right.x * side * pose.width * 0.34 +
        up.x * pose.width * 0.15;
      const anchorY =
        pose.foreheadY +
        right.y * side * pose.width * 0.34 +
        up.y * pose.width * 0.15;

      context.save();
      context.translate(anchorX, anchorY);
      context.rotate(pose.roll + side * 0.035);
      context.scale(side * perspective, 1);
      context.globalAlpha = 0.98;
      context.shadowColor = "rgba(45, 30, 25, 0.2)";
      context.shadowBlur = Math.max(4, pose.width * 0.022);
      context.shadowOffsetY = Math.max(2, pose.width * 0.01);
      context.drawImage(image, -size * 0.5, -size * 0.54, size, size);
      context.restore();
    }
  }

  private drawAssetMuzzle(
    context: DrawingContext,
    pose: FacePose,
    image: CanvasImageSource,
  ) {
    const size = pose.width * 0.52;
    const yawScale = clamp(1 - Math.abs(pose.yaw) * 0.15, 0.84, 1);

    context.save();
    context.translate(pose.noseX, pose.noseY + pose.height * 0.025);
    context.rotate(pose.roll);
    context.scale(yawScale, 1);
    context.globalAlpha = 0.97;
    context.shadowColor = "rgba(60, 39, 35, 0.16)";
    context.shadowBlur = Math.max(2, pose.width * 0.012);
    context.shadowOffsetY = Math.max(1, pose.width * 0.006);
    context.drawImage(image, -size * 0.5, -size * 0.43, size, size);
    context.restore();
  }

  private drawAssetBlush(context: DrawingContext, pose: FacePose) {
    const right = {
      x: Math.cos(pose.roll),
      y: Math.sin(pose.roll),
    };
    const down = {
      x: -Math.sin(pose.roll),
      y: Math.cos(pose.roll),
    };
    const radius = pose.width * 0.12;

    for (const side of [-1, 1] as const) {
      const x =
        pose.centerX +
        right.x * side * pose.width * 0.28 +
        down.x * pose.height * 0.08;
      const y =
        pose.centerY +
        right.y * side * pose.width * 0.28 +
        down.y * pose.height * 0.08;
      const blush = context.createRadialGradient(x, y, 0, x, y, radius);
      blush.addColorStop(0, "rgba(246, 119, 134, 0.22)");
      blush.addColorStop(0.55, "rgba(246, 119, 134, 0.1)");
      blush.addColorStop(1, "rgba(246, 119, 134, 0)");
      context.fillStyle = blush;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  private drawFaceGlitter(context: DrawingContext, pose: FacePose) {
    const pulse = 0.94 + Math.sin(performance.now() / 320) * 0.06;

    context.save();
    context.translate(pose.centerX, pose.centerY);
    context.rotate(pose.roll);
    context.fillStyle = "#fffaf2";
    context.shadowColor = "rgba(255, 239, 213, 0.66)";
    context.shadowBlur = Math.max(1, pose.width * 0.009);

    for (const point of CAT_GLITTER) {
      const x = point.x * pose.width * 0.49;
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

  private drawAssetWhiskers(context: DrawingContext, pose: FacePose) {
    const scale = pose.width;
    context.save();
    context.translate(pose.noseX, pose.noseY);
    context.rotate(pose.roll);
    context.strokeStyle = "rgba(255, 250, 244, 0.9)";
    context.lineWidth = Math.max(1.1, scale * 0.0045);
    context.lineCap = "round";
    context.shadowColor = "rgba(76, 48, 51, 0.5)";
    context.shadowBlur = Math.max(1, scale * 0.004);

    for (const side of [-1, 1] as const) {
      for (const offset of [-0.65, 0, 0.65]) {
        context.beginPath();
        context.moveTo(side * scale * 0.17, scale * (0.055 + offset * 0.018));
        context.quadraticCurveTo(
          side * scale * 0.32,
          scale * (0.052 + offset * 0.045),
          side * scale * 0.47,
          scale * (0.035 + offset * 0.07),
        );
        context.stroke();
      }
    }

    context.restore();
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
    context.lineWidth = 0.065;
    context.strokeStyle = "rgba(76, 48, 51, 0.82)";
    context.shadowColor = "rgba(20, 63, 86, 0.2)";
    context.shadowBlur = 0.13;
    context.shadowOffsetY = 0.06;

    const outer = context.createLinearGradient(-0.4, -0.9, 0.45, 0.5);
    outer.addColorStop(0, "#f8d7ac");
    outer.addColorStop(0.58, config.outer);
    outer.addColorStop(1, "#c9784f");
    context.beginPath();
    context.moveTo(-0.56, 0.44);
    context.quadraticCurveTo(-0.38, -0.48, 0.03, -1.12);
    context.quadraticCurveTo(0.48, -0.43, 0.56, 0.46);
    context.quadraticCurveTo(0.02, 0.64, -0.56, 0.44);
    context.closePath();
    context.fillStyle = outer;
    context.fill();
    context.stroke();

    context.shadowColor = "transparent";
    const inner = context.createLinearGradient(0, -0.78, 0, 0.32);
    inner.addColorStop(0, "#f9d4d0");
    inner.addColorStop(1, config.inner);
    context.beginPath();
    context.moveTo(-0.29, 0.27);
    context.quadraticCurveTo(-0.19, -0.29, 0.03, -0.76);
    context.quadraticCurveTo(0.3, -0.27, 0.32, 0.29);
    context.quadraticCurveTo(0.03, 0.39, -0.29, 0.27);
    context.closePath();
    context.fillStyle = inner;
    context.fill();

    context.strokeStyle = "rgba(255, 247, 239, 0.75)";
    context.lineWidth = 0.055;
    context.lineCap = "round";
    for (const tuft of [-0.22, 0, 0.22]) {
      context.beginPath();
      context.moveTo(tuft * 0.7, 0.36);
      context.quadraticCurveTo(tuft, 0.16, tuft * 1.1, -0.02);
      context.stroke();
    }

    context.restore();
  }

  private drawFaceDetails(
    context: DrawingContext,
    config: AnimalConfig,
    pose: FacePose,
  ) {
    const scale = Math.max(6, pose.width * config.noseScale);
    context.save();
    context.translate(pose.noseX, pose.noseY);
    context.rotate(pose.roll);

    const blush = context.createRadialGradient(0, 0, 0, 0, 0, scale * 1.5);
    blush.addColorStop(0, "rgba(244, 134, 120, 0.28)");
    blush.addColorStop(1, "rgba(244, 134, 120, 0)");
    context.fillStyle = blush;
    for (const side of [-1, 1] as const) {
      context.save();
      context.translate(side * scale * 2.7, scale * 0.85);
      context.scale(1.35, 0.58);
      context.beginPath();
      context.arc(0, 0, scale * 1.28, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    context.fillStyle = config.muzzle;
    context.strokeStyle = "rgba(92, 64, 59, 0.12)";
    context.lineWidth = Math.max(1, scale * 0.07);
    for (const side of [-1, 1] as const) {
      context.beginPath();
      context.ellipse(
        side * scale * 0.62,
        scale * 0.72,
        scale * 0.88,
        scale * 0.7,
        side * 0.1,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.stroke();
    }

    context.fillStyle = config.nose;
    context.strokeStyle = "rgba(255, 247, 239, 0.76)";
    context.lineWidth = Math.max(1, scale * 0.08);
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(-scale, -scale * 0.24);
    context.quadraticCurveTo(0, -scale * 0.72, scale, -scale * 0.24);
    context.quadraticCurveTo(scale * 0.6, scale * 0.8, 0, scale * 0.94);
    context.quadraticCurveTo(-scale * 0.6, scale * 0.8, -scale, -scale * 0.24);
    context.closePath();
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(255, 255, 255, 0.62)";
    context.beginPath();
    context.ellipse(
      -scale * 0.28,
      -scale * 0.22,
      scale * 0.2,
      scale * 0.12,
      -0.25,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.strokeStyle = config.accent;
    context.lineWidth = Math.max(1.2, scale * 0.1);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, scale * 0.76);
    context.lineTo(0, scale * 1.2);
    context.moveTo(0, scale * 1.18);
    context.bezierCurveTo(
      -scale * 0.18,
      scale * 1.48,
      -scale * 0.42,
      scale * 1.52,
      -scale * 0.58,
      scale * 1.34,
    );
    context.moveTo(0, scale * 1.18);
    context.bezierCurveTo(
      scale * 0.18,
      scale * 1.48,
      scale * 0.42,
      scale * 1.52,
      scale * 0.58,
      scale * 1.34,
    );
    context.stroke();

    context.strokeStyle = "rgba(92, 64, 59, 0.88)";
    context.lineWidth = Math.max(1.1, scale * 0.085);
    context.shadowColor = "rgba(255, 247, 239, 0.86)";
    context.shadowBlur = Math.max(1, scale * 0.1);
    for (const side of [-1, 1] as const) {
      for (const offset of [-0.5, 0.05, 0.6]) {
        context.beginPath();
        context.moveTo(side * scale * 0.92, scale * (0.73 + offset * 0.18));
        context.quadraticCurveTo(
          side * scale * 2.1,
          scale * (0.63 + offset * 0.38),
          side * scale * 3.35,
          scale * (0.67 + offset),
        );
        context.stroke();
      }
    }

    context.restore();
  }

  private drawEyeAccents(
    context: DrawingContext,
    landmarks: NormalizedLandmark[],
    roll: number,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    const eyes = [
      { indices: LEFT_EYE, outerSide: -1 as const },
      { indices: RIGHT_EYE, outerSide: 1 as const },
    ];

    context.save();
    context.strokeStyle = "rgba(76, 48, 51, 0.82)";
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const { indices, outerSide } of eyes) {
      const bounds = landmarkBounds(
        landmarks,
        indices,
        canvasWidth,
        canvasHeight,
      );
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const width = Math.max(8, bounds.maxX - bounds.minX);
      const height = Math.max(4, bounds.maxY - bounds.minY);

      context.save();
      context.translate(centerX, centerY);
      context.rotate(roll);
      context.lineWidth = Math.max(1.2, width * 0.045);
      context.beginPath();
      context.moveTo(-width * 0.4, -height * 0.72);
      context.quadraticCurveTo(0, -height * 1.05, width * 0.42, -height * 0.72);
      context.stroke();

      context.beginPath();
      context.moveTo(outerSide * width * 0.36, -height * 0.75);
      context.quadraticCurveTo(
        outerSide * width * 0.55,
        -height * 0.86,
        outerSide * width * 0.68,
        -height * 1.06,
      );
      context.stroke();
      context.restore();
    }

    context.restore();
  }

  private drawSparkle(context: DrawingContext, pose: FacePose) {
    const right = {
      x: Math.cos(pose.roll),
      y: Math.sin(pose.roll),
    };
    const up = {
      x: Math.sin(pose.roll),
      y: -Math.cos(pose.roll),
    };
    const pulse = 0.9 + Math.sin(performance.now() / 260) * 0.1;
    const size = Math.max(6, pose.width * 0.055) * pulse;
    const x =
      pose.foreheadX + right.x * pose.width * 0.27 + up.x * pose.width * 0.3;
    const y =
      pose.foreheadY + right.y * pose.width * 0.27 + up.y * pose.width * 0.3;

    context.save();
    context.translate(x, y);
    context.rotate(pose.roll + Math.PI / 4);
    context.fillStyle = "#f4c94f";
    context.strokeStyle = "rgba(76, 48, 51, 0.68)";
    context.lineWidth = Math.max(1, size * 0.09);
    context.shadowColor = "rgba(244, 201, 79, 0.4)";
    context.shadowBlur = size * 0.45;
    context.beginPath();
    context.moveTo(0, -size);
    context.quadraticCurveTo(size * 0.18, -size * 0.18, size, 0);
    context.quadraticCurveTo(size * 0.18, size * 0.18, 0, size);
    context.quadraticCurveTo(-size * 0.18, size * 0.18, -size, 0);
    context.quadraticCurveTo(-size * 0.18, -size * 0.18, 0, -size);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
}
