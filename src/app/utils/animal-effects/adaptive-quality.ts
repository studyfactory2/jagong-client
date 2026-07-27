export type AdaptiveQualityLevel = "full" | "balanced" | "economy";

export type AdaptiveQualityProfile = {
  detectionMaxEdge: number;
  detectionIntervalDesktopMs: number;
  detectionIntervalCompactMs: number;
  beautyEnabled: boolean;
  beautyStrength: number;
  targetFps: number;
};

type PerformanceSample = {
  frameCostMs: number;
  inputIntervalMs: number;
};

const QUALITY_PROFILES: Record<
  AdaptiveQualityLevel,
  AdaptiveQualityProfile
> = {
  full: {
    detectionMaxEdge: 384,
    detectionIntervalDesktopMs: 58,
    detectionIntervalCompactMs: 72,
    beautyEnabled: true,
    beautyStrength: 0.34,
    targetFps: 24,
  },
  balanced: {
    detectionMaxEdge: 320,
    detectionIntervalDesktopMs: 84,
    detectionIntervalCompactMs: 100,
    beautyEnabled: true,
    beautyStrength: 0.3,
    targetFps: 24,
  },
  economy: {
    detectionMaxEdge: 288,
    detectionIntervalDesktopMs: 120,
    detectionIntervalCompactMs: 145,
    beautyEnabled: false,
    beautyStrength: 0,
    targetFps: 18,
  },
};

const PERFORMANCE_SAMPLE_SIZE = 48;
const QUALITY_CHANGE_COOLDOWN_MS = 4_000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getInitialQualityLevel = (): AdaptiveQualityLevel => {
  const compactViewport =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;
  const limitedCores =
    typeof navigator !== "undefined" &&
    typeof navigator.hardwareConcurrency === "number" &&
    navigator.hardwareConcurrency <= 4;

  return compactViewport || limitedCores ? "balanced" : "full";
};

export class AdaptiveQualityController {
  private level: AdaptiveQualityLevel = getInitialQualityLevel();
  private performanceSamples: PerformanceSample[] = [];
  private healthyPerformanceWindows = 0;
  private lastQualityChange = 0;
  private lastInputFrameAt = 0;
  private lastInputIntervalMs = 0;
  private frameEmissionCredit = 1;

  get profile() {
    return QUALITY_PROFILES[this.level];
  }

  shouldProcessFrame(now: number) {
    const targetFps = this.profile.targetFps;
    if (this.lastInputFrameAt === 0) {
      this.lastInputFrameAt = now;
      this.lastInputIntervalMs = 0;
      this.frameEmissionCredit = 0;
      return true;
    }

    const elapsed = clamp(now - this.lastInputFrameAt, 0, 250);
    this.lastInputFrameAt = now;
    this.lastInputIntervalMs = elapsed;
    if (targetFps >= 24) return true;

    this.frameEmissionCredit = Math.min(
      2,
      this.frameEmissionCredit + (elapsed * targetFps) / 1_000,
    );

    if (this.frameEmissionCredit < 1) return false;
    this.frameEmissionCredit -= 1;
    return true;
  }

  recordFrameCost(frameCostMs: number, now: number) {
    if (!Number.isFinite(frameCostMs)) return;

    this.performanceSamples.push({
      frameCostMs,
      inputIntervalMs: this.lastInputIntervalMs,
    });
    if (this.performanceSamples.length < PERFORMANCE_SAMPLE_SIZE) return;

    const samples = this.performanceSamples;
    this.performanceSamples = [];
    const averageCost =
      samples.reduce((total, sample) => total + sample.frameCostMs, 0) /
      samples.length;
    const slowFrames = samples.filter(
      (sample) => sample.frameCostMs >= 32,
    ).length;
    const slowCadenceFrames = samples.filter(
      (sample) => sample.inputIntervalMs >= 58,
    ).length;

    if (now - this.lastQualityChange < QUALITY_CHANGE_COOLDOWN_MS) return;

    if (this.level === "full") {
      if (
        averageCost >= 20 ||
        slowFrames >= 8 ||
        slowCadenceFrames >= 18
      ) {
        this.setLevel("balanced", now);
      }
      return;
    }

    if (this.level === "balanced") {
      if (
        averageCost >= 28 ||
        slowFrames >= 12 ||
        slowCadenceFrames >= 24
      ) {
        this.setLevel("economy", now);
        return;
      }

      if (
        averageCost <= 12 &&
        slowFrames <= 2 &&
        slowCadenceFrames <= 6
      ) {
        this.healthyPerformanceWindows += 1;
        if (this.healthyPerformanceWindows >= 4) {
          this.setLevel("full", now);
        }
      } else {
        this.healthyPerformanceWindows = 0;
      }
      return;
    }

    if (
      averageCost <= 16 &&
      slowFrames <= 3 &&
      slowCadenceFrames <= 6
    ) {
      this.healthyPerformanceWindows += 1;
      if (this.healthyPerformanceWindows >= 3) {
        this.setLevel("balanced", now);
      }
    } else {
      this.healthyPerformanceWindows = 0;
    }
  }

  private setLevel(level: AdaptiveQualityLevel, changedAt: number) {
    if (level === this.level) return;

    this.level = level;
    this.lastQualityChange = changedAt;
    this.healthyPerformanceWindows = 0;
    this.performanceSamples = [];
    this.lastInputFrameAt = 0;
    this.lastInputIntervalMs = 0;
    this.frameEmissionCredit = 1;
  }
}
