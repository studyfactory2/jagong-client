import type { AnimalConfig } from "./animal-config";
import type { DrawingContext, FacePose } from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export class BasicAnimalRenderer {
  draw(context: DrawingContext, config: AnimalConfig, pose: FacePose) {
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
    context.lineWidth = 0.045;
    context.strokeStyle = "rgba(20, 63, 86, 0.2)";
    context.shadowColor = "rgba(20, 63, 86, 0.18)";
    context.shadowBlur = 0.11;
    context.shadowOffsetY = 0.05;

    if (config.ear === "round") {
      context.beginPath();
      context.ellipse(0, -0.12, 0.72, 0.72, 0, 0, Math.PI * 2);
      context.fillStyle = config.outer;
      context.fill();
      context.stroke();
      context.shadowColor = "transparent";
      context.beginPath();
      context.ellipse(0, -0.12, 0.4, 0.4, 0, 0, Math.PI * 2);
      context.fillStyle = config.inner;
      context.fill();
    } else if (config.ear === "tall") {
      context.beginPath();
      context.ellipse(0, -0.48, 0.42, 1.08, 0.02, 0, Math.PI * 2);
      context.fillStyle = config.outer;
      context.fill();
      context.stroke();
      context.shadowColor = "transparent";
      context.beginPath();
      context.ellipse(0, -0.5, 0.2, 0.8, 0.02, 0, Math.PI * 2);
      context.fillStyle = config.inner;
      context.fill();
    } else if (config.ear === "floppy") {
      context.beginPath();
      context.moveTo(-0.28, -0.5);
      context.bezierCurveTo(0.18, -0.72, 0.76, -0.25, 0.72, 0.34);
      context.bezierCurveTo(0.69, 0.9, 0.25, 1.2, -0.06, 0.82);
      context.bezierCurveTo(-0.3, 0.5, -0.38, -0.18, -0.28, -0.5);
      context.closePath();
      context.fillStyle = config.outer;
      context.fill();
      context.stroke();
      context.shadowColor = "transparent";
      context.beginPath();
      context.moveTo(-0.1, -0.36);
      context.bezierCurveTo(0.2, -0.42, 0.49, -0.08, 0.46, 0.36);
      context.bezierCurveTo(0.43, 0.68, 0.22, 0.84, 0.06, 0.6);
      context.bezierCurveTo(-0.06, 0.37, -0.14, -0.13, -0.1, -0.36);
      context.fillStyle = config.inner;
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(-0.52, 0.42);
      context.quadraticCurveTo(-0.34, -0.52, 0.04, -1.08);
      context.quadraticCurveTo(0.43, -0.46, 0.52, 0.46);
      context.quadraticCurveTo(0.04, 0.62, -0.52, 0.42);
      context.closePath();
      context.fillStyle = config.outer;
      context.fill();
      context.stroke();
      context.shadowColor = "transparent";
      context.beginPath();
      context.moveTo(-0.27, 0.26);
      context.quadraticCurveTo(-0.18, -0.3, 0.03, -0.72);
      context.quadraticCurveTo(0.27, -0.28, 0.3, 0.28);
      context.closePath();
      context.fillStyle = config.inner;
      context.fill();
    }

    context.restore();
  }

  private drawFaceDetails(
    context: DrawingContext,
    config: AnimalConfig,
    pose: FacePose,
  ) {
    const scale = Math.max(5, pose.width * config.noseScale);
    context.save();
    context.translate(pose.noseX, pose.noseY);
    context.rotate(pose.roll);

    context.fillStyle = config.muzzle;
    context.beginPath();
    context.ellipse(
      -scale * 0.62,
      scale * 0.72,
      scale * 0.82,
      scale * 0.66,
      -0.12,
      0,
      Math.PI * 2,
    );
    context.ellipse(
      scale * 0.62,
      scale * 0.72,
      scale * 0.82,
      scale * 0.66,
      0.12,
      0,
      Math.PI * 2,
    );
    context.fill();

    if (config.cheekMarks) {
      context.fillStyle = "rgba(255, 247, 236, 0.72)";
      for (const side of [-1, 1] as const) {
        context.beginPath();
        context.moveTo(side * scale * 1.2, scale * 0.35);
        context.lineTo(side * scale * 2.6, scale * 1.25);
        context.lineTo(side * scale * 1.15, scale * 1.55);
        context.closePath();
        context.fill();
      }
    }

    context.fillStyle = config.nose;
    context.strokeStyle = "rgba(20, 63, 86, 0.28)";
    context.lineWidth = Math.max(1, scale * 0.11);
    context.lineJoin = "round";
    if (config.noseKind === "triangle") {
      context.beginPath();
      context.moveTo(-scale, -scale * 0.25);
      context.quadraticCurveTo(0, -scale * 0.72, scale, -scale * 0.25);
      context.quadraticCurveTo(scale * 0.62, scale * 0.82, 0, scale * 0.95);
      context.quadraticCurveTo(
        -scale * 0.62,
        scale * 0.82,
        -scale,
        -scale * 0.25,
      );
      context.closePath();
    } else {
      context.beginPath();
      context.ellipse(0, 0, scale, scale * 0.72, 0, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(255, 255, 255, 0.55)";
    context.beginPath();
    context.ellipse(
      -scale * 0.26,
      -scale * 0.2,
      scale * 0.2,
      scale * 0.13,
      -0.25,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.strokeStyle = "rgba(20, 63, 86, 0.76)";
    context.lineWidth = Math.max(1.2, scale * 0.12);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, scale * 0.78);
    context.lineTo(0, scale * 1.45);
    context.stroke();

    if (config.whiskers) {
      context.strokeStyle = config.accent;
      context.lineWidth = Math.max(1.1, scale * 0.09);
      context.shadowColor = "rgba(20, 63, 86, 0.32)";
      context.shadowBlur = Math.max(1, scale * 0.08);
      for (const side of [-1, 1] as const) {
        for (const offset of [-0.4, 0.12, 0.64]) {
          context.beginPath();
          context.moveTo(side * scale * 0.9, scale * (0.75 + offset * 0.18));
          context.quadraticCurveTo(
            side * scale * 2.2,
            scale * (0.68 + offset * 0.42),
            side * scale * 3.35,
            scale * (0.72 + offset),
          );
          context.stroke();
        }
      }
    }

    context.restore();
  }
}
