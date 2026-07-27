import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type AnimalEffectVariant = "cat" | "dog" | "bear" | "bunny" | "fox";

export type AccessoryEffectVariant = "medical-mask" | "beard";

export type FaceEffectVariant =
  | AnimalEffectVariant
  | AccessoryEffectVariant;

export type FaceEffectOptions = {
  variant: FaceEffectVariant;
};

export type DrawingContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export type EffectCanvas = OffscreenCanvas | HTMLCanvasElement;

export type Point = {
  x: number;
  y: number;
};

export type FacePose = {
  foreheadX: number;
  foreheadY: number;
  centerX: number;
  centerY: number;
  noseX: number;
  noseY: number;
  width: number;
  height: number;
  roll: number;
  yaw: number;
  pitch: number;
};

export type TrackingResult = {
  landmarks: NormalizedLandmark[];
  pose: FacePose;
};
