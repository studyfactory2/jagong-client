export const ConsultationInputType = {
  PHONE: "PHONE",
  VIDEO: "VIDEO",
  QUESTION: "QUESTION",
  IMMEDIATE: "IMMEDIATE",
} as const;

export type ConsultationInputType =
  (typeof ConsultationInputType)[keyof typeof ConsultationInputType];
