import type { AnimalEffectVariant } from "./types";

export type EarKind = "pointed" | "floppy" | "round" | "tall";
export type NoseKind = "triangle" | "oval";

export type AnimalConfig = {
  ear: EarKind;
  noseKind: NoseKind;
  outer: string;
  inner: string;
  nose: string;
  muzzle: string;
  accent: string;
  earScale: number;
  earSpread: number;
  earLift: number;
  earTilt: number;
  noseScale: number;
  whiskers: boolean;
  cheekMarks: boolean;
};

export const ANIMAL_CONFIGS: Record<AnimalEffectVariant, AnimalConfig> = {
  cat: {
    ear: "pointed",
    noseKind: "triangle",
    outer: "#e7a66e",
    inner: "#f4b5b6",
    nose: "#4c3033",
    muzzle: "rgba(255, 247, 239, 0.92)",
    accent: "#5c403b",
    earScale: 0.31,
    earSpread: 0.36,
    earLift: 0.16,
    earTilt: 0.08,
    noseScale: 0.058,
    whiskers: true,
    cheekMarks: false,
  },
  dog: {
    ear: "floppy",
    noseKind: "oval",
    outer: "#8a5a3c",
    inner: "#d6a889",
    nose: "#2f3032",
    muzzle: "rgba(245, 224, 207, 0.82)",
    accent: "#fff4ea",
    earScale: 0.32,
    earSpread: 0.4,
    earLift: 0.04,
    earTilt: 0.24,
    noseScale: 0.062,
    whiskers: false,
    cheekMarks: false,
  },
  bear: {
    ear: "round",
    noseKind: "oval",
    outer: "#6b4a35",
    inner: "#caa588",
    nose: "#2d2a29",
    muzzle: "rgba(232, 205, 177, 0.84)",
    accent: "#fff6ec",
    earScale: 0.22,
    earSpread: 0.35,
    earLift: 0.13,
    earTilt: 0,
    noseScale: 0.06,
    whiskers: false,
    cheekMarks: false,
  },
  bunny: {
    ear: "tall",
    noseKind: "triangle",
    outer: "#f3f0ee",
    inner: "#f7b8c8",
    nose: "#ed8296",
    muzzle: "rgba(255, 255, 255, 0.76)",
    accent: "#ffffff",
    earScale: 0.34,
    earSpread: 0.22,
    earLift: 0.28,
    earTilt: 0.06,
    noseScale: 0.045,
    whiskers: true,
    cheekMarks: false,
  },
  fox: {
    ear: "pointed",
    noseKind: "triangle",
    outer: "#d9772f",
    inner: "#fff0dc",
    nose: "#2b2c2e",
    muzzle: "rgba(255, 242, 224, 0.78)",
    accent: "#fff7ec",
    earScale: 0.3,
    earSpread: 0.36,
    earLift: 0.15,
    earTilt: 0.14,
    noseScale: 0.052,
    whiskers: true,
    cheekMarks: true,
  },
};
