import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Point } from "./types";

export const LEFT_EYE = [
  33, 133, 159, 145, 160, 144, 158, 153, 157, 154, 173, 246, 161, 163,
];
export const RIGHT_EYE = [
  362, 263, 386, 374, 385, 373, 387, 380, 384, 381, 398, 466, 388, 390,
];
export const LEFT_CHEEK = 234;
export const RIGHT_CHEEK = 454;
export const FOREHEAD = 10;
export const CHIN = 152;
export const NOSE_TIP = 1;
export const UPPER_LIP = 13;
export const LOWER_LIP = 14;

export const landmarkPoint = (
  landmarks: NormalizedLandmark[],
  index: number,
  width: number,
  height: number,
): Point => {
  const point = landmarks[index];
  return {
    x: point.x * width,
    y: point.y * height,
  };
};

export const averageLandmarkPoint = (
  landmarks: NormalizedLandmark[],
  indices: number[],
  width: number,
  height: number,
): Point => {
  let x = 0;
  let y = 0;
  for (const index of indices) {
    const point = landmarkPoint(landmarks, index, width, height);
    x += point.x;
    y += point.y;
  }
  return {
    x: x / indices.length,
    y: y / indices.length,
  };
};

export const landmarkBounds = (
  landmarks: NormalizedLandmark[],
  indices: number[],
  width: number,
  height: number,
) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const index of indices) {
    const point = landmarkPoint(landmarks, index, width, height);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
};
