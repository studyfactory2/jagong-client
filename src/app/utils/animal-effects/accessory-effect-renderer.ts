import { closeEffectImage, loadEffectImage } from "./effect-asset-loader";
import type { AccessoryEffectVariant, DrawingContext, FacePose } from "./types";

type LowerFaceAccessoryVariant = Exclude<AccessoryEffectVariant, "glasses">;

type AccessoryAssets = Record<LowerFaceAccessoryVariant, CanvasImageSource>;

type AccessoryDrawConfig = {
  size: number;
  verticalOffset: number;
  shadow: string;
};

const ACCESSORY_ASSETS: Record<LowerFaceAccessoryVariant, string> = {
  "medical-mask": "/effects/accessories/medical-mask.webp",
  beard: "/effects/accessories/beard.webp",
};

const ACCESSORY_DRAW_CONFIGS: Record<
  LowerFaceAccessoryVariant,
  AccessoryDrawConfig
> = {
  "medical-mask": {
    size: 1.28,
    verticalOffset: -0.32,
    shadow: "rgba(43, 55, 52, 0.18)",
  },
  beard: {
    size: 1.2,
    verticalOffset: -0.36,
    shadow: "rgba(36, 22, 16, 0.22)",
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export class AccessoryEffectRenderer {
  private assets: AccessoryAssets | null = null;

  async init() {
    const [medicalMask, beard] = await Promise.all([
      loadEffectImage(ACCESSORY_ASSETS["medical-mask"]),
      loadEffectImage(ACCESSORY_ASSETS.beard),
    ]);
    this.assets = {
      "medical-mask": medicalMask,
      beard,
    };
  }

  isReady(variant: LowerFaceAccessoryVariant) {
    return this.assets?.[variant] !== undefined;
  }

  draw(
    context: DrawingContext,
    variant: LowerFaceAccessoryVariant,
    pose: FacePose,
  ) {
    const image = this.assets?.[variant];
    if (!image) return false;

    const config = ACCESSORY_DRAW_CONFIGS[variant];
    const size = pose.width * config.size;
    const yawScale = clamp(1 - Math.abs(pose.yaw) * 0.14, 0.86, 1);

    context.save();
    context.translate(pose.noseX, pose.noseY + pose.height * 0.02);
    context.rotate(pose.roll);
    context.scale(yawScale, 1);
    context.globalAlpha = 0.99;
    context.shadowColor = config.shadow;
    context.shadowBlur = Math.max(3, pose.width * 0.018);
    context.shadowOffsetY = Math.max(1, pose.width * 0.008);
    context.drawImage(
      image,
      -size * 0.5,
      size * config.verticalOffset,
      size,
      size,
    );
    context.restore();
    return true;
  }

  destroy() {
    if (this.assets) {
      closeEffectImage(this.assets["medical-mask"]);
      closeEffectImage(this.assets.beard);
    }
    this.assets = null;
  }
}
